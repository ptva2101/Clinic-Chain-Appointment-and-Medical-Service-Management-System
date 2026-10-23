import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// This writes appointments and notifications. Never point it at shared/real data.
if (__ENV.LOAD_TEST_ISOLATED !== '1') {
  throw new Error('Set LOAD_TEST_ISOLATED=1 only for a disposable test stack')
}

const required = [
  'APPOINTMENT_PATIENT_ACCESS_TOKEN', 'APPOINTMENT_CONFIG_CODE',
  'APPOINTMENT_DOCTOR_CODE', 'APPOINTMENT_DATE', 'APPOINTMENT_SHIFT',
]
for (const name of required) {
  if (!__ENV[name]) throw new Error(`Missing ${name}`)
}

const baseUrl = (__ENV.APPOINTMENT_URL || 'http://appointment:8000').replace(/\/$/, '')
const base = `${baseUrl}/api/v1/appointments`
const headers = {
  Authorization: `Bearer ${__ENV.APPOINTMENT_PATIENT_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
}
const bookingSuccess = new Rate('booking_success')
const cancellationSuccess = new Rate('cancellation_success')
const bookingDuration = new Trend('booking_duration_ms', true)

export const options = {
  scenarios: {
    booking_and_cancel: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.VUS || 2),
      iterations: Number(__ENV.ITERATIONS_PER_VU || 10),
      maxDuration: '3m',
    },
  },
  thresholds: {
    booking_success: ['rate>0.99'],
    cancellation_success: ['rate>0.99'],
    booking_duration_ms: ['p(95)<1500'],
  },
}

export default function () {
  const key = `load-${__VU}-${__ITER}-${Date.now()}`
  const payload = JSON.stringify({
    config_code: __ENV.APPOINTMENT_CONFIG_CODE,
    doctor_code: __ENV.APPOINTMENT_DOCTOR_CODE,
    date: __ENV.APPOINTMENT_DATE,
    shift: Number(__ENV.APPOINTMENT_SHIFT),
    idempotency_key: key,
  })
  const booked = http.post(base, payload, { headers, tags: { name: 'book_appointment' } })
  bookingDuration.add(booked.timings.duration)
  const bookedOk = check(booked, {
    'booking returns confirmed appointment': (res) =>
      res.status === 201 && res.json('status') === 'confirmed',
  })
  bookingSuccess.add(bookedOk)
  if (!bookedOk) return

  const appointmentId = booked.json('id')
  const cancelled = http.post(`${base}/${appointmentId}/cancel`, null, {
    headers, tags: { name: 'cancel_appointment' },
  })
  const cancelledOk = check(cancelled, {
    'cancellation returns cancelled appointment': (res) =>
      res.status === 200 && res.json('status') === 'cancelled',
  })
  cancellationSuccess.add(cancelledOk)
  sleep(0.05)
}
