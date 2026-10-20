const clinicalUrl = `${(import.meta.env.VITE_CLINICAL_URL || 'http://127.0.0.1:8006').replace(/\/$/, '')}/api/v1/clinical`
const laboratoryUrl = `${(import.meta.env.VITE_LABORATORY_URL || 'http://127.0.0.1:8007').replace(/\/$/, '')}/api/v1/laboratory`

export const fetchClinicalCatalog = (kind) => fetch(`${clinicalUrl}/catalog/${kind}`, { cache: 'no-store' })

const authorization = (token, json = false) => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
})

async function legacyResponse(response, transform) {
  const body = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.status,
    json: async () => ({
      success: response.ok,
      message: response.ok ? '' : (typeof body?.detail === 'string' ? body.detail : 'Không thể xử lý lượt khám.'),
      data: response.ok ? transform(body) : null,
    }),
  }
}

const legacyLab = (row, encounterId) => ({
  MaChiTietXN: row.id,
  MaLuotKham: encounterId,
  MaDichVu: row.service_code,
  KetQuaXetNghiem: row.result_text || '',
  MaXNV: row.technician_code || '',
  PaymentToken: row.payment_token || '',
  GiaCuoi: row.list_price,
  TrangThaiXetNghiem: row.status === 'resulted' ? 'Đã có kết quả' : 'Chưa thực hiện',
})

const legacyVisit = (row, labs = [], plans = [], sessionsByPlan = new Map()) => ({
  MaLuotKham: row.id,
  MaLichHen: row.appointment_id,
  MaBenhAn: row.patient_id,
  MaBacSi: row.doctor_code,
  MaChiNhanh: row.branch_code,
  NgayKham: row.visit_date,
  MaBenh: row.disease_code || '',
  TrieuChung: row.symptoms,
  LoiDan: row.advice || '',
  TrangThai: row.status === 'completed' ? 'Hoàn thành' : 'Chờ kết luận',
  XetNghiem: labs.filter((lab) => lab.encounter_id === row.id).map((lab) => legacyLab(lab, row.id)),
  DonThuoc: row.prescriptions.map((item, index) => ({
    MaDonThuoc: `${row.id}-${index}`, MaLuotKham: row.id, MaThuoc: item.medicine_code,
    SoLuong: item.quantity, LieuDung: item.dosage || '',
  })),
  DieuTri: row.treatments.flatMap((item) => {
    const plan = plans.find((entry) => entry.encounter_id === row.id && entry.service_code === item.service_code)
    if (!plan) return []
    const sessions = sessionsByPlan.get(plan.id) || []
    return Array.from({ length: plan.total_sessions }, (_, index) => {
      const number = index + 1
      const session = sessions.find((entry) => entry.session_number === number)
      return {
        MaLichTrinh: `${plan.id}:${number}`, MaLichHen: session?.appointment_id || '',
        MaLuotKham: row.id, MaDichVu: item.service_code, BuoiSo: number,
        NgayThucHien: session?.date || '', CaKham: session?.shift || '',
        TrangThai: session?.status === 'completed' ? 'Hoàn thành'
          : session?.status === 'booked' ? 'Đã đặt lịch' : 'Chưa đặt lịch',
      }
    })
  }),
})

async function fetchHistory(path, labPath, token, filter = () => true) {
  const [encounterResponse, labResponse] = await Promise.all([
    fetch(`${clinicalUrl}${path}`, { headers: authorization(token), cache: 'no-store' }),
    fetch(`${laboratoryUrl}${labPath}`, { headers: authorization(token), cache: 'no-store' }),
  ])
  if (!encounterResponse.ok) return legacyResponse(encounterResponse, () => [])
  if (!labResponse.ok) return legacyResponse(labResponse, () => [])
  const labs = await labResponse.json()
  return legacyResponse(encounterResponse, (rows) => rows.filter(filter).map((row) => legacyVisit(row, labs)))
}

export const getCompletedEncounters = (_doctorId, token) => fetchHistory(
  '/encounters/doctor', '/orders/doctor', token, (row) => row.status === 'completed',
)

export const getDoctorPatientHistory = (patientId, token) => fetchHistory(
  `/encounters/patient/${encodeURIComponent(patientId)}`, '/orders/doctor', token,
)

export const getPatientMedicalHistory = async (_patientId, token) => {
  const [encounterResponse, labResponse, planResponse] = await Promise.all([
    fetch(`${clinicalUrl}/encounters/me`, { headers: authorization(token), cache: 'no-store' }),
    fetch(`${laboratoryUrl}/orders/me`, { headers: authorization(token), cache: 'no-store' }),
    fetch(`${clinicalUrl}/treatments/me`, { headers: authorization(token), cache: 'no-store' }),
  ])
  if (!encounterResponse.ok) return legacyResponse(encounterResponse, () => [])
  if (!labResponse.ok) return legacyResponse(labResponse, () => [])
  if (!planResponse.ok) return legacyResponse(planResponse, () => [])
  const [labs, plans] = await Promise.all([labResponse.json(), planResponse.json()])
  const sessionResponses = await Promise.all(plans.map((plan) => fetch(
    `${clinicalUrl}/treatments/${encodeURIComponent(plan.id)}/sessions`,
    { headers: authorization(token), cache: 'no-store' },
  )))
  if (sessionResponses.some((response) => !response.ok)) {
    const failed = sessionResponses.find((response) => !response.ok)
    return legacyResponse(failed, () => [])
  }
  const sessionsByPlan = new Map(await Promise.all(sessionResponses.map(async (response, index) => [
    plans[index].id, await response.json(),
  ])))
  return legacyResponse(encounterResponse, (rows) => rows.map((row) => legacyVisit(row, labs, plans, sessionsByPlan)))
}

export const getEncounterDetail = async (query, token) => {
  const encounterId = new URLSearchParams(query).get('ma_luot_kham')
  const [encounterResponse, labResponse] = await Promise.all([
    fetch(`${clinicalUrl}/encounters/${encodeURIComponent(encounterId)}`, { headers: authorization(token) }),
    fetch(`${laboratoryUrl}/orders/doctor`, { headers: authorization(token) }),
  ])
  const labs = labResponse.ok ? await labResponse.json() : []
  return legacyResponse(encounterResponse, (row) => {
    const visit = legacyVisit(row, labs)
    return { LuotKham: visit, XetNghiem: visit.XetNghiem, DonThuoc: visit.DonThuoc, DieuTri: visit.DieuTri }
  })
}

export const completeAppointment = async (options, token) => {
  const payload = JSON.parse(options.body)
  const response = await fetch(`${clinicalUrl}/encounters`, {
    method: 'POST', headers: authorization(token, true),
    body: JSON.stringify({
      appointment_id: payload.ma_lich_hen,
      disease_code: payload.ma_benh || null,
      symptoms: payload.trieu_chung,
      advice: payload.loi_dan || null,
      lab_service_codes: (payload.xet_nghiem || []).map((item) => item.ma_dich_vu).filter(Boolean),
      prescriptions: (payload.don_thuoc || []).filter((item) => item.ma_thuoc).map((item) => ({
        medicine_code: item.ma_thuoc, quantity: item.so_luong || 1, dosage: item.lieu_dung || null,
      })),
      treatments: (payload.dieu_tri || []).filter((item) => item.ma_dich_vu).map((item) => ({
        service_code: item.ma_dich_vu, sessions: item.so_buoi || 1,
      })),
      is_draft: Boolean(payload.is_draft),
    }),
  })
  if (!response.ok) return legacyResponse(response, () => null)
  const row = await response.json()
  const labsResponse = await fetch(`${laboratoryUrl}/orders/doctor`, { headers: authorization(token) })
  const labs = labsResponse.ok ? await labsResponse.json() : []
  const body = legacyVisit(row, labs)
  return {
    ok: true,
    status: response.status,
    json: async () => ({ success: true, message: '', data: body }),
  }
}

export const completeTreatmentSession = async (options, token) => {
  const payload = JSON.parse(options.body)
  const response = await fetch(
    `${clinicalUrl}/treatments/sessions/${encodeURIComponent(payload.ma_lich_hen)}/complete`,
    { method: 'POST', headers: authorization(token) },
  )
  return legacyResponse(response, (row) => ({
    MaLichTrinh: `${row.plan_id}:${row.session_number}`,
    MaLichHen: row.appointment_id,
    MaBacSi: row.doctor_code,
    TrangThai: 'Hoàn thành',
  }))
}
