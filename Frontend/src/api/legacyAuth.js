import { legacyFetch } from './legacy.js'

// Main dashboard sessions still require legacy profile data. IdentityPortal uses identity.js.
export const restoreLegacySession = (options) => legacyFetch('/auth/session-user', options)
export const loginLegacyRole = (endpoint, options) => legacyFetch(endpoint, options)
