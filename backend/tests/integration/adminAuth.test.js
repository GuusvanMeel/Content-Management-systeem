import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createAdmin,
  createOrganisationRow,
  newAgent,
  resetDatabase,
  sidCookie,
} from '../helpers/testApp.js'

beforeEach(resetDatabase)

describe('administrator login (FR-001 – FR-003, FR-017)', () => {
  it('logs in with a session cookie without expiry date', async () => {
    const admin = await createAdmin()
    const agent = newAgent()

    const res = await agent.post('/api/auth/admin/login').send({ username: admin.username, password: admin.password })
    expect(res.status).toBe(204)
    const cookie = sidCookie(res)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Strict/)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).not.toMatch(/Expires=|Max-Age=/i)

    const me = await agent.get('/api/auth/me')
    expect(me.body).toEqual({ role: 'admin', username: admin.username })
  })

  it('gives one generic message for a wrong password and an unknown user', async () => {
    const admin = await createAdmin()
    for (const body of [
      { username: admin.username, password: 'wrong-password-1' },
      { username: 'nobody', password: admin.password },
    ]) {
      const res = await newAgent().post('/api/auth/admin/login').send(body)
      expect(res.status).toBe(401)
      expect(res.body.error).toEqual({ code: 'invalid_credentials', message: 'Gebruikersnaam of wachtwoord onjuist.' })
      expect(sidCookie(res)).toBeUndefined()
    }
  })

  it('does not log login attempts (FR-029)', async () => {
    const admin = await createAdmin()
    await newAgent().post('/api/auth/admin/login').send({ username: admin.username, password: 'wrong-password-1' })
    await newAgent().post('/api/auth/admin/login').send({ username: admin.username, password: admin.password })
    const [{ count }] = await db('AdminActionLog').count({ count: '*' })
    expect(Number(count)).toBe(0)
  })

  it('protects the admin routes', async () => {
    const noSession = await newAgent().get('/api/admin/organisations')
    expect(noSession.status).toBe(401)
    expect(noSession.body.error.code).toBe('not_authenticated')

    const organisation = await createOrganisationRow()
    const { agent } = await agentWithSession({ organisationId: organisation.id })
    const asOrganisation = await agent.get('/api/admin/organisations')
    expect(asOrganisation.status).toBe(403)
  })

  it('has no registration route (FR-003)', async () => {
    const res = await newAgent().post('/api/auth/register').send({ username: 'x', password: 'y'.repeat(12) })
    expect(res.status).toBe(404)
  })
})
