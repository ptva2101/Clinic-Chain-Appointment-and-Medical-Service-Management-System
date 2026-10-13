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

export const createDoctorSchedules = (accessToken, schedules) =>
  request('/doctor-schedules/bulk', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules }),
  })

// These operations need Appointment and Billing orchestration before they can be safe.
export const cancelDoctorSchedules = () => { throw new Error('Chưa hỗ trợ hủy ca trực có thể ảnh hưởng lịch hẹn.') }
export const transferDoctorSchedules = () => { throw new Error('Chưa hỗ trợ chuyển ca trực có thể ảnh hưởng lịch hẹn.') }
