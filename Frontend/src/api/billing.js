import { legacyFetch } from './legacy.js'

export const getMonthlyReport = (month) => legacyFetch(`/admin/reports/monthly?month=${encodeURIComponent(month)}`)
