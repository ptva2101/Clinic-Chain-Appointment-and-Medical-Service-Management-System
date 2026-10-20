const appointmentUrl = `${(import.meta.env.VITE_APPOINTMENT_URL || 'http://127.0.0.1:8004').replace(/\/$/, '')}/api/v1/appointments`

const authorization = (accessToken) => ({ Authorization: `Bearer ${accessToken}` })

const toLegacyQueueRow = (row) => ({
  MaLichHen: row.id,
  MaBenhAn: row.patient_id,
  MaCauHinh: row.config_code,
  MaChiNhanh: row.branch_code,
  MaDichVu: row.service_code,
  MaBacSi: row.doctor_code,
  NgayKham: row.date,
  CaKham: row.shift,
  STT: row.queue_number,
  STT_HangDoi: row.queue_number,
  MaLeTan: row.receptionist_code,
  ThoiGianCheckIn: row.checked_in_at,
  TrangThai: ({ waiting: 'Chờ khám', examining: 'Đang khám', conclusion: 'Chờ kết luận', completed: 'Hoàn thành' })[row.queue_state] || 'Đã xác nhận',
  HoTen: row.patient_name,
  TenBenhNhan: row.patient_name,
  CCCD: row.patient_cccd,
  SDT: row.patient_phone,
  SDTBenhNhan: row.patient_phone,
  NgaySinh: row.patient_date_of_birth,
})

async function legacyQueueResponse(response, { single = false, emptyIsFailure = false } = {}) {
  const body = await response.json().catch(() => null)
  const data = response.ok ? (single ? toLegacyQueueRow(body) : body.map(toLegacyQueueRow)) : null
  const success = response.ok && (!emptyIsFailure || data.length > 0)
  return {
    ok: response.ok,
    status: response.status,
    json: async () => ({ success, message: success ? '' : body?.detail || 'Không tìm thấy lịch khám phù hợp.', data }),
  }
}

export const getDoctorQueue = async (_doctorId, accessToken) => {
  const clinicalUrl = `${(import.meta.env.VITE_CLINICAL_URL || 'http://127.0.0.1:8006').replace(/\/$/, '')}/api/v1/clinical`
  const [queueResponse, encountersResponse] = await Promise.all([
    fetch(`${appointmentUrl}/doctor/queue`, { headers: authorization(accessToken), cache: 'no-store' }),
    fetch(`${clinicalUrl}/encounters/doctor`, { headers: authorization(accessToken), cache: 'no-store' }),
  ])
  if (!queueResponse.ok) return legacyQueueResponse(queueResponse)
  const queueRows = await queueResponse.json()
  const encounters = encountersResponse.ok ? await encountersResponse.json() : []
  const encounterByAppointment = new Map(encounters.map((row) => [row.appointment_id, row.id]))
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: '', data: queueRows.map((row) => ({
      ...toLegacyQueueRow(row), MaLuotKham: encounterByAppointment.get(row.id) || '',
    })) }),
  }
}

export const updateAppointmentStatus = async (options, accessToken) => {
  const appointmentId = options.body.get('ma_lich_hen')
  const state = ({ 'Đang khám': 'examining', 'Chờ kết luận': 'conclusion', 'Hoàn thành': 'completed' })[options.body.get('trang_thai')]
  if (!state) throw new Error('Trạng thái hàng chờ không hợp lệ.')
  return legacyQueueResponse(await fetch(`${appointmentUrl}/${encodeURIComponent(appointmentId)}/queue-state`, {
    method: 'POST', headers: { ...authorization(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  }), { single: true })
}

export const getCheckinAppointments = async (query, accessToken) => {
  const params = new URLSearchParams(query)
  return legacyQueueResponse(await fetch(`${appointmentUrl}/reception/appointments?${new URLSearchParams({ date: params.get('ngay') })}`, {
    headers: authorization(accessToken), cache: 'no-store',
  }))
}

export const getWaitingList = async (doctorId, date, _query, accessToken) => legacyQueueResponse(
  await fetch(`${appointmentUrl}/reception/waiting-list/${encodeURIComponent(doctorId)}?${new URLSearchParams({ date })}`, {
    headers: authorization(accessToken), cache: 'no-store',
  }),
)

export const searchCheckinAppointment = async (query, accessToken) => {
  const params = new URLSearchParams(query)
  return legacyQueueResponse(await fetch(`${appointmentUrl}/reception/search?${new URLSearchParams({
    keyword: params.get('keyword') || '', date: params.get('ngay') || '',
  })}`, { headers: authorization(accessToken), cache: 'no-store' }), { emptyIsFailure: true })
}

export const checkIn = async (options, accessToken) => legacyQueueResponse(
  await fetch(`${appointmentUrl}/${encodeURIComponent(options.body.get('ma_lich_hen'))}/check-in`, {
    method: 'POST', headers: authorization(accessToken),
  }), { single: true },
)
export const getPatientAppointments = (accessToken) => fetch(`${appointmentUrl}/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
  cache: 'no-store',
})
export const createPatientAppointment = (accessToken, booking) => fetch(appointmentUrl, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(booking),
})
export const cancelPatientAppointment = (accessToken, appointmentId) => fetch(
  `${appointmentUrl}/${encodeURIComponent(appointmentId)}/cancel`,
  { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
)
export const getPatientNotifications = (accessToken) => fetch(`${appointmentUrl}/notifications/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
  cache: 'no-store',
})
export const markPatientNotificationsRead = (accessToken) => fetch(`${appointmentUrl}/notifications/mark-read`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
})
export const bookTreatment = async (options, accessToken) => {
  const clinicalUrl = `${(import.meta.env.VITE_CLINICAL_URL || 'http://127.0.0.1:8006').replace(/\/$/, '')}/api/v1/clinical`
  const payload = JSON.parse(options.body)
  const [planId, numberText] = payload.ma_lich_trinh.split(':')
  const sessionNumber = Number(numberText)
  if (!planId || !Number.isInteger(sessionNumber)) {
    throw new Error('Liệu trình điều trị chưa có mã hợp lệ từ Clinical.')
  }
  const response = await fetch(`${clinicalUrl}/treatments/${encodeURIComponent(planId)}/sessions`, {
    method: 'POST',
    headers: { ...authorization(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config_code: payload.ma_cau_hinh,
      doctor_code: payload.ma_bac_si,
      date: payload.ngay_thuc_hien,
      shift: payload.ca_kham,
      session_number: sessionNumber,
      idempotency_key: `treatment:${payload.ma_lich_trinh}`,
    }),
  })
  const body = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.status,
    json: async () => ({
      success: response.ok,
      message: response.ok ? '' : (typeof body?.detail === 'string' ? body.detail : 'Không thể đặt buổi điều trị.'),
      data: response.ok ? {
        appointment: {
          MaLichHen: body.appointment_id, MaBenhAn: payload.ma_benh_an,
          MaCauHinh: payload.ma_cau_hinh, MaBacSi: body.doctor_code,
          NgayKham: body.date, CaKham: body.shift, TrangThai: 'Đã xác nhận',
        },
        treatment: {
          MaLichTrinh: payload.ma_lich_trinh, MaLichHen: body.appointment_id,
          NgayThucHien: body.date, CaKham: body.shift, TrangThai: 'Đã đặt lịch',
        },
        invoice_id: body.invoice_id,
      } : null,
    }),
  }
}
