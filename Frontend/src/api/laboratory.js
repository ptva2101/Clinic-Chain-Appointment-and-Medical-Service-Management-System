const baseUrl = `${(import.meta.env.VITE_LABORATORY_URL || 'http://127.0.0.1:8007').replace(/\/$/, '')}/api/v1/laboratory`

const headers = (token, json = false) => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
})

const toLegacyRow = (row) => ({
  MaChiTietXN: row.id,
  MaLuotKham: row.encounter_id,
  MaLichHen: row.appointment_id,
  MaBenhAn: row.patient_id,
  MaChiNhanh: row.branch_code,
  MaBacSi: row.doctor_code,
  MaDichVu: row.service_code,
  GiaGoc: row.list_price,
  GiaCuoi: row.list_price,
  PaymentToken: row.payment_token || '',
  KetQuaXetNghiem: row.result_text || '',
  MaXNV: row.technician_code || '',
  HoTen: row.patient_name || 'Chưa cập nhật',
  SDT: row.patient_phone || '',
  TrangThaiXetNghiem: row.status === 'resulted' ? 'Đã có kết quả' : 'Chưa thực hiện',
})

async function legacyResponse(response, transform) {
  const body = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.status,
    json: async () => ({
      success: response.ok,
      message: response.ok ? '' : (typeof body?.detail === 'string' ? body.detail : 'Không thể xử lý xét nghiệm.'),
      data: response.ok ? transform(body) : null,
    }),
  }
}

export const getTests = async (_branchId, token) => legacyResponse(
  await fetch(`${baseUrl}/orders`, { headers: headers(token), cache: 'no-store' }),
  (rows) => rows.map(toLegacyRow),
)

export const acceptTest = async (options, token) => legacyResponse(
  await fetch(`${baseUrl}/orders/${encodeURIComponent(options.body.get('MaChiTietXN'))}/accept`, {
    method: 'POST', headers: headers(token),
  }),
  (row) => ({ PaymentToken: row.payment_token, GiaCuoi: row.list_price }),
)

export const updateResult = async (options, token) => legacyResponse(
  await fetch(`${baseUrl}/orders/${encodeURIComponent(options.body.get('MaChiTietXN'))}/result`, {
    method: 'POST', headers: headers(token, true),
    body: JSON.stringify({ result_text: options.body.get('KetQuaXetNghiem'), notes: options.body.get('GhiChu') || null }),
  }),
  toLegacyRow,
)
