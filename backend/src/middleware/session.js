import { config } from '../config/env.js'
import { deleteById, findByToken, touch } from '../modules/auth/sessionRepository.js'

export const SESSION_COOKIE = 'sid'

// No Expires/Max-Age: a session cookie that the browser drops when it closes (FR-019).
const cookieOptions = () => ({
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  sameSite: 'strict',
  path: '/',
})

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, cookieOptions())
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions())
}

/**
 * Resolves the session cookie into req.auth and req.authState:
 * - 'none': no cookie was sent;
 * - 'expired': the cookie points to a session that is unknown, timed out or ended (FR-010, FR-019a);
 * - 'ok': a valid session, which is extended by this request.
 */
export async function session(req, res, next) {
  req.auth = null
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) {
    req.authState = 'none'
    return next()
  }

  const found = await findByToken(token, config.SESSION_IDLE_TIMEOUT_MINUTES)
  if (!found || found.expired || (found.organisationId && found.organisationDeletedAt)) {
    if (found) await deleteById(found.id)
    clearSessionCookie(res)
    req.authState = 'expired'
    return next()
  }

  await touch(found.id)
  req.authState = 'ok'
  req.auth = found.administratorId
    ? { role: 'admin', administratorId: found.administratorId, username: found.username, sessionId: found.id }
    : { role: 'organisation', organisationId: found.organisationId, sessionId: found.id }
  next()
}
