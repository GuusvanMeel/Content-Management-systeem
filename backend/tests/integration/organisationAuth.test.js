import { beforeEach, describe, expect, it } from 'vitest'
import { createOrganisationRow, newAgent, resetDatabase, sidCookie } from '../helpers/testApp.js'

beforeEach(resetDatabase)

const GENERIC = { code: 'invalid_credentials', message: 'Organisatiecode of wachtwoord onjuist.' }

describe('organisation login (FR-012, FR-015 – FR-018)', () => {
  it('logs in with the code in any case and works on behalf of that organisation', async () => {
    const organisation = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
    const agent = newAgent()

    const res = await agent
      .post('/api/auth/organisation/login')
      .send({ loginCode: '  zwembad-a ', password: organisation.password })
    expect(res.status).toBe(204)
    expect(sidCookie(res)).toBeTruthy()

    const self = await agent.get('/api/organisation')
    expect(self.body).toEqual({ id: organisation.id, name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
    const me = await agent.get('/api/auth/me')
    expect(me.body.role).toBe('organisation')

    await agent.post('/api/auth/logout')
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('gives the same generic error for every kind of failure', async () => {
    const organisation = await createOrganisationRow({ loginCode: 'ZWEMBAD-A', questLinkCode: 'QZ7K2M9X' })
    await createOrganisationRow({ name: 'Weg', loginCode: 'WEG', password: 'deleted-password', deletedAt: new Date() })

    for (const body of [
      { loginCode: 'ZWEMBAD-A', password: 'wrong-password-1' },
      { loginCode: 'ONBEKEND', password: organisation.password },
      { loginCode: 'QZ7K2M9X', password: organisation.password },
      { loginCode: 'WEG', password: 'deleted-password' },
    ]) {
      const res = await newAgent().post('/api/auth/organisation/login').send(body)
      expect(res.status, body.loginCode).toBe(401)
      expect(res.body.error).toEqual(GENERIC)
    }
  })

  it('does not block after many failed attempts (FR-018)', async () => {
    const organisation = await createOrganisationRow({ loginCode: 'ZWEMBAD-A' })
    for (let i = 0; i < 10; i++) {
      await newAgent().post('/api/auth/organisation/login').send({ loginCode: 'ZWEMBAD-A', password: `wrong-${i}-password` })
    }
    const res = await newAgent()
      .post('/api/auth/organisation/login')
      .send({ loginCode: 'ZWEMBAD-A', password: organisation.password })
    expect(res.status).toBe(204)
  })
})
