const baseUrl = (import.meta.env.VITE_LEGACY_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

// The remaining domain APIs still live in the original backend.
// Keep the native fetch Response contract until their services are implemented.
export function legacyFetch(path, options) {
  return fetch(`${baseUrl}${path}`, options)
}
