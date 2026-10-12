import { legacyFetch } from './legacy.js'

export const getCompletedEncounters = (doctorId) => legacyFetch(`/doctor/completed-encounters?ma_bac_si=${encodeURIComponent(doctorId)}`)
export const getDoctorPatientHistory = (patientId) => legacyFetch(`/doctor/patient-history?ma_benh_an=${encodeURIComponent(patientId)}`)
export const getEncounterDetail = (query) => legacyFetch(`/doctor/encounter-detail?${query}`)
export const completeAppointment = (options) => legacyFetch('/doctor/complete-appointment', options)
export const completeTreatmentSession = (options) => legacyFetch('/doctor/complete-treatment-session', options)
export const getPatientMedicalHistory = (patientId) => legacyFetch(`/patient/medical-history?ma_benh_an=${encodeURIComponent(patientId)}`)
