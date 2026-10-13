const baseUrl = `${(import.meta.env.VITE_REGISTRY_URL || 'http://127.0.0.1:8002').replace(/\/$/, '')}/api/v1/registry`

async function request(accessToken, options = {}) {
  const response = await fetch(`${baseUrl}/patients/me`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể tải hồ sơ bệnh nhân.')
  }
  return result
}

export const getPatientProfile = (accessToken) => request(accessToken)

export const updatePatientProfile = (accessToken, changes) => request(accessToken, {
  method: 'PATCH',
  body: JSON.stringify(changes),
})

export async function listPatients(accessToken, { search = '', limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (search.trim()) params.set('q', search.trim())
  const response = await fetch(`${baseUrl}/patients?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể tải danh sách bệnh nhân.')
  }
  return result
}
