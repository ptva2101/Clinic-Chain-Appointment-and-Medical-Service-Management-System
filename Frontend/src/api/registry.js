const baseUrl = `${(import.meta.env.VITE_REGISTRY_URL || 'http://127.0.0.1:8002').replace(/\/$/, '')}/api/v1/registry/catalog`
const registryUrl = baseUrl.replace(/\/catalog$/, '')

export async function getInsuranceCategories() {
  const response = await fetch(`${registryUrl}/insurance/categories`, { cache: 'no-store' })
  const result = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(result)) {
    throw new Error('Không thể tải nhóm BHYT từ Registry.')
  }
  return result
}

export async function verifyPatientInsurance(accessToken, patientId, verified) {
  const response = await fetch(`${registryUrl}/patients/${encodeURIComponent(patientId)}/insurance-verification`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể xác minh BHYT.')
  }
  return result
}

export function catalogEndpoints() {
  return {
    branches: '/branches',
    services: '/services',
    doctors: '/doctors',
    branchServices: '/branch-services',
  }
}

export const fetchCatalog = (endpoint) => fetch(`${baseUrl}${endpoint}`, { cache: 'no-store' })

async function writeCatalog(path, accessToken, method, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể lưu danh mục Registry.')
  }
  return result
}

export const createBranch = (token, branch) => writeCatalog('/branches', token, 'POST', branch)
export const createService = (token, service) => writeCatalog('/services', token, 'POST', service)
export const updateServicePrice = (token, code, price) =>
  writeCatalog(`/services/${encodeURIComponent(code)}/price`, token, 'PATCH', { GiaGoc: price })
export const saveBranchService = (token, config) =>
  writeCatalog(`/branch-services/${encodeURIComponent(config.MaCauHinh)}`, token, 'PUT', config)
export const updateBranchService = (token, code, changes) =>
  writeCatalog(`/branch-services/${encodeURIComponent(code)}`, token, 'PATCH', changes)
