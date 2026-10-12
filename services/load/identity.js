import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.IDENTITY_BASE_URL || 'http://identity:8000'
const username = __ENV.IDENTITY_TEST_USERNAME
const password = __ENV.IDENTITY_TEST_PASSWORD

if (!username || !password) {
  throw new Error('Set IDENTITY_TEST_USERNAME and IDENTITY_TEST_PASSWORD for the load test')
}

export const options = {
  scenarios: {
    identity_login: { executor: 'constant-vus', vus: 2, duration: '20s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
}

export default function () {
  const login = http.post(`${baseUrl}/api/v1/identity/login`, JSON.stringify({
    role: __ENV.IDENTITY_TEST_ROLE || 'patient', username, password,
  }), { headers: { 'Content-Type': 'application/json' } })
  if (!check(login, { 'login 200': (response) => response.status === 200 })) return

  const tokens = login.json()
  const me = http.get(`${baseUrl}/api/v1/identity/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  check(me, { 'me 200': (response) => response.status === 200 })

  const logout = http.post(`${baseUrl}/api/v1/identity/logout`, JSON.stringify({
    refresh_token: tokens.refresh_token,
  }), { headers: { 'Content-Type': 'application/json' } })
  check(logout, { 'logout 204': (response) => response.status === 204 })
  sleep(1)
}
