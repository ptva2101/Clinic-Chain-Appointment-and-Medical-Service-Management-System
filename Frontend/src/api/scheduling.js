import { legacyFetch } from './legacy.js'

export const doctorScheduleCatalogEndpoint = (fromDate, toDate) =>
  `/catalog/doctor-schedules?from_date=${fromDate}&to_date=${toDate}`

export const listDoctorSchedules = (query) => legacyFetch(`/admin/doctor-schedules?${query}`)
export const createDoctorSchedules = (options) => legacyFetch('/admin/doctor-schedules/create', options)
export const cancelDoctorSchedules = (options) => legacyFetch('/admin/doctor-schedules/cancel', options)
export const transferDoctorSchedules = (options) => legacyFetch('/admin/doctor-schedules/transfer', options)
