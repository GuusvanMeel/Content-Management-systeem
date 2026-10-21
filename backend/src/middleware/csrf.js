import { AppError } from '../lib/errors.js'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Together with SameSite=Strict cookies this blocks cross-site form posts (research R4).
export function csrf(req, _res, next) {
  if (WRITE_METHODS.has(req.method) && req.get('X-Requested-With') !== 'cms') {
    return next(new AppError(403, 'csrf_header_missing', 'Dit verzoek is geweigerd.'))
  }
  next()
}
