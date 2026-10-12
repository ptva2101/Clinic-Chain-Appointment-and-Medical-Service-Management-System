import { legacyFetch } from './legacy.js'

export const getTests = (branchId) => legacyFetch(`/xnv/tests?ma_chi_nhanh=${encodeURIComponent(branchId)}`)
export const acceptTest = (options) => legacyFetch('/xnv/accept-test', options)
export const updateResult = (options) => legacyFetch('/xnv/update-result', options)
