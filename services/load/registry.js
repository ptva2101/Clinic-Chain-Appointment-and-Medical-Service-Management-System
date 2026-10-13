import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.REGISTRY_BASE_URL || 'http://registry:8000'
const accessToken = __ENV.REGISTRY_PATIENT_ACCESS_TOKEN

if (!accessToken) {
  throw new Error('Set REGISTRY_PATIENT_ACCESS_TOKEN to a patient Identity access token')
}

export const options = {
  scenarios: {
    registry_profile_read: { executor: 'constant-vus', vus: 2, duration: '20s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
}

export default function () {
  const response = http.get(`${baseUrl}/api/v1/registry/patients/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  check(response, { 'profile 200': (result) => result.status === 200 })
  sleep(1)
}
