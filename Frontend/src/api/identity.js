const baseUrl = `${(import.meta.env.VITE_IDENTITY_URL || 'http://127.0.0.1:8001').replace(/\/$/, '')}/api/v1/identity`

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (response.status === 204) return null
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const message = typeof result?.detail === 'string' ? result.detail : 'Yêu cầu không thành công.'
    throw new Error(message)
  }
  return result
}

export function registerAccount(username, password) {
  return request('/register', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), password }),
  })
}

export function loginAccount(role, username, password) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ role, username: username.trim(), password }),
  })
}

export function getCurrentAccount(accessToken) {
  return request('/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function logoutAccount(refreshToken) {
  return request('/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}
