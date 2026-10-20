const baseUrl = `${(import.meta.env.VITE_SCHEDULING_URL || 'http://127.0.0.1:8003').replace(/\/$/, '')}/api/v1/scheduling`

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store', ...options })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = typeof result?.detail === 'string'
      ? result.detail
      : Array.isArray(result?.detail) ? result.detail[0]?.msg : ''
    throw new Error(detail || 'Không thể tải lịch trực từ Scheduling.')
  }
  return result
}

export const listDoctorSchedules = (query = '') =>
  request(`/doctor-schedules${query ? `?${query}` : ''}`)

export const getSchedulingAvailability = ({ configCode, doctorCode, date, shift }) =>
  request(`/availability?${new URLSearchParams({
    config_code: configCode,
    doctor_code: doctorCode,
    date,
    shift: String(shift),
  })}`)

export const createDoctorSchedules = (accessToken, schedules) =>
  request('/doctor-schedules/bulk', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules }),
  })

const scheduleId = (body) => {
  const value = body.id ?? Number(String(body.MaLichTruc || '').replace(/^LT_/, ''))
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) throw new Error('Mã lịch trực không hợp lệ.')
  return Number(value)
}

const legacyScheduleResponse = (schedule) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, message: '', data: { schedule, affectedPatients: [] } }),
})

export const cancelDoctorSchedules = async (options, accessToken) => {
  const body = JSON.parse(options.body)
  const schedule = await request(`/doctor-schedules/${scheduleId(body)}/cancel`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
  })
  return legacyScheduleResponse(schedule)
}

export const transferDoctorSchedules = async (options, accessToken) => {
  const body = JSON.parse(options.body)
  const schedule = await request(`/doctor-schedules/${scheduleId(body)}/transfer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_doctor_code: body.newMaBacSi }),
  })
  return legacyScheduleResponse(schedule)
}
