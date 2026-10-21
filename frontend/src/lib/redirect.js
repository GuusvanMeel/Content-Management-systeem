/**
 * Validates the ?redirect= target after logging in: only paths within this app, and only within
 * the environment the user just logged in to.
 */
export function safeRedirect(raw, { admin }) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null
  const isAdminPath = raw === '/admin' || raw.startsWith('/admin/')
  if (raw.startsWith('/admin/login') || raw.startsWith('/login')) return null
  return isAdminPath === admin ? raw : null
}
