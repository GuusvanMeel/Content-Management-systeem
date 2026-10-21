import { Router } from 'express'
import { notAuthenticated, sessionExpired } from '../../lib/errors.js'
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from '../../middleware/session.js'
import { findActiveById } from '../organisations/organisationRepository.js'
import { loginAdmin, loginOrganisation } from './authService.js'
import { deleteById, deleteByToken } from './sessionRepository.js'

export const authRoutes = Router()

// Logging in replaces any session the browser already had.
async function startSession(req, res, token) {
  if (req.auth?.sessionId) await deleteById(req.auth.sessionId)
  setSessionCookie(res, token)
  res.status(204).end()
}

authRoutes.post('/admin/login', async (req, res) => {
  const token = await loginAdmin(req.body?.username, req.body?.password)
  await startSession(req, res, token)
})

authRoutes.post('/organisation/login', async (req, res) => {
  const token = await loginOrganisation(req.body?.loginCode, req.body?.password)
  await startSession(req, res, token)
})

// Always 204, also without a session or with an expired one.
authRoutes.post('/logout', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) await deleteByToken(token)
  clearSessionCookie(res)
  res.status(204).end()
})

authRoutes.get('/me', async (req, res) => {
  if (req.authState === 'none') throw notAuthenticated()
  if (req.authState === 'expired') throw sessionExpired()
  if (req.auth.role === 'admin') {
    return res.json({ role: 'admin', username: req.auth.username })
  }
  const organisation = await findActiveById(req.auth.organisationId)
  if (!organisation) throw sessionExpired()
  res.json({
    role: 'organisation',
    organisation: { id: organisation.id, name: organisation.name, loginCode: organisation.loginCode },
  })
})
