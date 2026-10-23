const billingUrl = `${(import.meta.env.VITE_BILLING_URL || 'http://127.0.0.1:8005').replace(/\/$/, '')}/api/v1/billing`

export const getMonthlyReport = (month, accessToken) => fetch(
  `${billingUrl}/reports/monthly?month=${encodeURIComponent(month)}`,
  { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
)

export const getGroupedReport = (groupBy, month, accessToken) => fetch(
  `${billingUrl}/reports/${encodeURIComponent(groupBy)}?month=${encodeURIComponent(month)}`,
  { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
)

export const getPatientInvoices = (accessToken) => fetch(`${billingUrl}/invoices/me`, {
  headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
})

export const getAdminInvoices = (accessToken, { limit = 10, offset = 0 } = {}) => fetch(
  `${billingUrl}/invoices?limit=${limit}&offset=${offset}`,
  { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
)

export const simulateAdminRefund = (accessToken, invoiceId) => fetch(
  `${billingUrl}/invoices/${encodeURIComponent(invoiceId)}/simulate-refund`,
  { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
)

export const createPatientInvoice = (accessToken, appointmentId) => fetch(`${billingUrl}/invoices`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ appointment_id: appointmentId }),
})

export const simulatePatientPayment = (accessToken, invoiceId) => fetch(
  `${billingUrl}/invoices/${encodeURIComponent(invoiceId)}/simulate-payment`,
  { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
)
