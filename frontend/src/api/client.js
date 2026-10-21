/** Error from the API, in the format of contracts/api.md. `message` is customer-facing (Dutch). */
export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

// A 401 on these requests is an expected answer, not a lost session.
const QUIET_401 = [/^\/api\/auth\/(admin|organisation)\/login$/, /^\/api\/auth\/me$/]

let unauthorizedHandler = null

/** Registers what happens on a 401 elsewhere (the router sends the user to the right login page). */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler
}

/**
 * Calls the API. Only user actions call this: the frontend never polls in the background, so an
 * open but unused tab does not keep the session alive (contracts/ui.md).
 */
export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = { 'X-Requested-With': 'cms' }
  let payload
  if (formData) {
    payload = formData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (res.ok) return data

  const e = data?.error ?? {}
  const error = new ApiError(
    res.status,
    e.code ?? 'unknown_error',
    e.message ?? 'Er ging iets mis. Probeer het later opnieuw.',
    e.fields ?? {},
  )
  if (res.status === 401 && !QUIET_401.some((pattern) => pattern.test(path))) {
    unauthorizedHandler?.(error)
  }
  throw error
}
