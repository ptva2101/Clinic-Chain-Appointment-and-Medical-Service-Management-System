import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
}

const baseUrl = __ENV.SCHEDULING_URL || 'http://scheduling:8000'

export default function () {
  const response = http.get(`${baseUrl}/api/v1/scheduling/doctor-schedules`)
  check(response, {
    'schedules return 200': (result) => result.status === 200,
    'schedules are an array': (result) => Array.isArray(result.json()),
  })
  sleep(0.1)
}
