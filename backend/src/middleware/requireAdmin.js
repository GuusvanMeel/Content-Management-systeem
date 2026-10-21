import { forbidden, notAuthenticated, sessionExpired } from '../lib/errors.js'

export function requireRole(role) {
  return (req, _res, next) => {
    if (req.authState === 'none') return next(notAuthenticated())
    if (req.authState === 'expired') return next(sessionExpired())
    if (req.auth?.role !== role) return next(forbidden())
    next()
  }
}

export const requireAdmin = requireRole('admin')
