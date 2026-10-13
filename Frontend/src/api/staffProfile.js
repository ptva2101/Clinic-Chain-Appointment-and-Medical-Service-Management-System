const baseUrl = `${(import.meta.env.VITE_REGISTRY_URL || 'http://127.0.0.1:8002').replace(/\/$/, '')}/api/v1/registry`

export async function getStaffProfile(accessToken) {
  const response = await fetch(`${baseUrl}/staff/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể tải hồ sơ nhân viên.')
  }
  return result
}

export async function listStaffProfiles(accessToken, { search = '', limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (search.trim()) params.set('q', search.trim())
  const response = await fetch(`${baseUrl}/staff?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể tải danh sách nhân viên.')
  }
  return result
}
