import { legacyFetch } from './legacy.js'

const appointmentUrl = `${(import.meta.env.VITE_APPOINTMENT_URL || 'http://127.0.0.1:8004').replace(/\/$/, '')}/api/v1/appointments`

export const getDoctorQueue = (doctorId) => legacyFetch(`/doctor/queue?ma_bac_si=${encodeURIComponent(doctorId)}`)
export const updateAppointmentStatus = (options) => legacyFetch('/doctor/update-appointment-status', options)
export const getCheckinAppointments = (query) => legacyFetch(`/letan/checkin-appointments?${query}`)
export const getWaitingList = (doctorId, date, query) => legacyFetch(`/letan/waiting-list/${encodeURIComponent(doctorId)}/${date}?${query}`)
export const searchCheckinAppointment = (query) => legacyFetch(`/letan/search-checkin-appointment?${query}`)
export const checkIn = (options) => legacyFetch('/letan/checkin', options)
export const getPatientAppointments = (patientId) => legacyFetch(`/patient/appointments?ma_benh_an=${encodeURIComponent(patientId)}`)
export const getPatientNotifications = (accessToken) => fetch(`${appointmentUrl}/notifications/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
  cache: 'no-store',
})
export const markPatientNotificationsRead = (accessToken) => fetch(`${appointmentUrl}/notifications/mark-read`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
})
// These two legacy endpoints orchestrate booking with payment/treatment today.
export const bookAndPay = (options) => legacyFetch('/patient/book-and-pay', options)
export const bookTreatment = (options) => legacyFetch('/patient/book-treatment', options)
