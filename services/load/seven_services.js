import http from 'k6/http'
import { check, sleep } from 'k6'

// Read-only business APIs on the disposable Compose stack, never patient data.
if (__ENV.LOAD_TEST_ISOLATED !== '1') {
  throw new Error('Set LOAD_TEST_ISOLATED=1 only for a disposable test stack')
}
if (!__ENV.PATIENT_ACCESS_TOKEN) {
  throw new Error('Missing PATIENT_ACCESS_TOKEN from the synthetic E2E fixture')
}

const services = [
  { name: 'identity', path: '/api/v1/identity/me', p95: 500 },
  { name: 'registry', path: '/api/v1/registry/patients/me', p95: 500 },
  { name: 'scheduling', path: '/api/v1/scheduling/doctor-schedules', p95: 800 },
  { name: 'appointment', path: '/api/v1/appointments/me', p95: 1500 },
  { name: 'billing', path: '/api/v1/billing/invoices/me', p95: 800 },
  { name: 'clinical', path: '/api/v1/clinical/encounters/me', p95: 1500 },
  { name: 'laboratory', path: '/api/v1/laboratory/orders/me', p95: 800 },
]

const thresholds = {}
for (const service of services) {
  thresholds[`http_req_duration{service:${service.name}}`] = [`p(95)<${service.p95}`]
  thresholds[`http_req_failed{service:${service.name}}`] = [
    service.name === 'appointment' || service.name === 'clinical' ? 'rate<0.01' : 'rate<0.005',
  ]
}

export const options = {
  scenarios: {
    business_reads: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds,
}

const headers = { Authorization: `Bearer ${__ENV.PATIENT_ACCESS_TOKEN}` }

export default function () {
  for (const service of services) {
    const response = http.get(`http://${service.name}:8000${service.path}`, {
      headers,
      tags: { service: service.name, name: `${service.name}_business_read` },
    })
    check(response, { [`${service.name} returns 200`]: (result) => result.status === 200 })
  }
  sleep(0.1)
}
