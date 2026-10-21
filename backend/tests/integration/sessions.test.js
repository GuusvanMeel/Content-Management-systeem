import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { runSessionCleanup } from '../../src/jobs/sessionCleanup.js'
import {
  agentWithSession,
  createAdmin,
  createOrganisationRow,
  newAgent,
  resetDatabase,
  sessionRowByToken,
  setLastActivity,
  sidCookie,
} from '../helpers/testApp.js'

beforeEach(resetDatabase)

const owners = [
  ['administrator', async () => ({ administratorId: (await createAdmin()).id })],
  ['organisation', async () => ({ organisationId: (await createOrganisationRow()).id })],
]

describe('session rules (FR-019, FR-019a, SC-008)', () => {
  it('returns 401 not_authenticated without a cookie', async () => {
    const res = await newAgent().get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('not_authenticated')
  })

  it('returns 401 session_expired for an unknown token and clears the cookie', async () => {
    const res = await newAgent().get('/api/auth/me').set('Cookie', 'sid=does-not-exist')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('session_expired')
    expect(res.body.error.message).toBe('Je sessie is verlopen. Log opnieuw in.')
    expect(sidCookie(res)).toMatch(/^sid=;/)
  })

  for (const [kind, makeOwner] of owners) {
    describe(`${kind} session`, () => {
      it('expires after 61 minutes of inactivity and the row is removed', async () => {
        const { agent, token } = await agentWithSession(await makeOwner())
        await setLastActivity(token, 61)

        const res = await agent.get('/api/auth/me')
        expect(res.status).toBe(401)
        expect(res.body.error.code).toBe('session_expired')
        expect(sidCookie(res)).toMatch(/^sid=;/)
        expect(await sessionRowByToken(token)).toBeUndefined()
      })

      it('is still valid after 59 minutes and every request extends it', async () => {
        const { agent, token } = await agentWithSession(await makeOwner())
        await setLastActivity(token, 59)

        const res = await agent.get('/api/auth/me')
        expect(res.status).toBe(200)

        const [{ ageSeconds }] = (
          await db.raw(
            'SELECT TIMESTAMPDIFF(SECOND, lastActivityAt, UTC_TIMESTAMP()) AS ageSeconds FROM `Session` WHERE tokenHash = SHA2(?, 256)',
            [token],
          )
        )[0]
        expect(Number(ageSeconds)).toBeLessThan(5)
      })

      it('ends on logout', async () => {
        const { agent, token } = await agentWithSession(await makeOwner())
        const res = await agent.post('/api/auth/logout')
        expect(res.status).toBe(204)
        expect(await sessionRowByToken(token)).toBeUndefined()
      })
    })
  }

  it('rejects the session of a deleted organisation', async () => {
    const organisation = await createOrganisationRow()
    const { agent } = await agentWithSession({ organisationId: organisation.id })
    await db('Organisation').where({ id: organisation.id }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })

    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('session_expired')
  })

  it('logout without a session still returns 204', async () => {
    const res = await newAgent().post('/api/auth/logout')
    expect(res.status).toBe(204)
  })
})

describe('session cleanup (FR-019b)', () => {
  it('removes only sessions older than the timeout', async () => {
    const admin = await createAdmin()
    const { token: oldToken } = await agentWithSession({ administratorId: admin.id })
    const { token: freshToken } = await agentWithSession({ administratorId: admin.id })
    await setLastActivity(oldToken, 61)
    await setLastActivity(freshToken, 30)

    expect(await runSessionCleanup()).toBe(1)
    expect(await sessionRowByToken(oldToken)).toBeUndefined()
    expect(await sessionRowByToken(freshToken)).toBeDefined()
  })
})

describe('CSRF (research R4)', () => {
  it('rejects a write request without X-Requested-With', async () => {
    const res = await newAgent().post('/api/auth/logout').unset('X-Requested-With')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('csrf_header_missing')
  })
})
