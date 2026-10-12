import { legacyFetch } from './legacy.js'

// Registry has not exposed its domain API yet; these calls retain the legacy contract.
export function catalogEndpoints() {
  return {
    branches: '/catalog/branches',
    services: '/catalog/services',
    branchServices: '/catalog/branch-services',
    diseases: '/catalog/diseases',
    medicines: '/catalog/medicines',
    bhyt: '/catalog/bhyt',
  }
}

export const fetchCatalog = (endpoint) => legacyFetch(endpoint)
