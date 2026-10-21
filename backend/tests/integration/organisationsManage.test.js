import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createAdmin, createOrganisationRow, newAgent, resetDatabase } from '../helpers/testApp.js'

let admin
let organisation

beforeEach(async () => {
  await resetDatabase()
  admin = (await agentWithSession({ administratorId: (await createAdmin()).id })).agent
  organisation = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
})

const login = (loginCode, password) => newAgent().post('/api/auth/organisation/login').send({ loginCode, password })
const parseDetails = (value) => (typeof value === 'string' ? JSON.parse(value) : value)
const logEntries = (action) => db('AdminActionLog').where({ organisationId: organisation.id, action })

describe('changing name and code (FR-008, FR-010)', () => {
  it('renames and logs the old and new name', async () => {
    const res = await admin.patch(`/api/admin/organisations/${organisation.id}`).send({ name: 'Zwembad B' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Zwembad B')

    const { agent } = await agentWithSession({ organisationId: organisation.id })
    expect((await agent.get('/api/organisation')).body.name).toBe('Zwembad B')

    const [entry] = await logEntries('update')
    expect(parseDetails(entry.details)).toEqual({ name: { old: 'Zwembad A', new: 'Zwembad B' } })
  })

  it('rejects an empty change and a taken code', async () => {
    expect((await admin.patch(`/api/admin/organisations/${organisation.id}`).send({})).status).toBe(400)

    await createOrganisationRow({ name: 'Weg', loginCode: 'WEG', deletedAt: new Date() })
    const taken = await admin.patch(`/api/admin/organisations/${organisation.id}`).send({ loginCode: 'weg' })
    expect(taken.status).toBe(409)
  })

  it('keeps sessions when the code only changes case', async () => {
    const { agent } = await agentWithSession({ organisationId: organisation.id })
    const res = await admin.patch(`/api/admin/organisations/${organisation.id}`).send({ loginCode: 'zwembad-a' })
    expect(res.status).toBe(200)
    expect((await agent.get('/api/organisation')).status).toBe(200)
  })

  it('ends sessions on a new code and only the new code works', async () => {
    const { agent } = await agentWithSession({ organisationId: organisation.id })
    const res = await admin.patch(`/api/admin/organisations/${organisation.id}`).send({ loginCode: 'ZWEMBAD-NIEUW' })
    expect(res.status).toBe(200)

    const after = await agent.get('/api/organisation')
    expect(after.status).toBe(401)
    expect(after.body.error.code).toBe('session_expired')

    expect((await login('ZWEMBAD-A', organisation.password)).status).toBe(401)
    expect((await login('ZWEMBAD-NIEUW', organisation.password)).status).toBe(204)

    const [entry] = await logEntries('update')
    expect(parseDetails(entry.details)).toEqual({ loginCode: { old: 'ZWEMBAD-A', new: 'ZWEMBAD-NIEUW' } })
  })
})

describe('password reset (FR-009, FR-010)', () => {
  it('validates the length', async () => {
    const res = await admin.put(`/api/admin/organisations/${organisation.id}/password`).send({ password: 'a'.repeat(9) })
    expect(res.status).toBe(400)
  })

  it('replaces the password but keeps running sessions', async () => {
    const { agent } = await agentWithSession({ organisationId: organisation.id })
    const res = await admin
      .put(`/api/admin/organisations/${organisation.id}/password`)
      .send({ password: 'brand-new-password' })
    expect(res.status).toBe(204)

    expect((await login('ZWEMBAD-A', organisation.password)).status).toBe(401)
    expect((await login('ZWEMBAD-A', 'brand-new-password')).status).toBe(204)
    expect((await agent.get('/api/organisation')).status).toBe(200)

    const [entry] = await logEntries('passwordReset')
    expect(entry.details).toBeNull()
  })
})

describe('soft delete (FR-010 – FR-012)', () => {
  it('removes the organisation from use but keeps its code reserved', async () => {
    const { agent } = await agentWithSession({ organisationId: organisation.id })

    expect((await admin.delete(`/api/admin/organisations/${organisation.id}`)).status).toBe(204)

    const list = await admin.get('/api/admin/organisations')
    expect(list.body.organisations).toHaveLength(0)
    expect((await login('ZWEMBAD-A', organisation.password)).status).toBe(401)
    expect((await agent.get('/api/organisation')).body.error.code).toBe('session_expired')

    const reuse = await admin
      .post('/api/admin/organisations')
      .send({ name: 'Nieuw', loginCode: 'ZWEMBAD-A', password: 'organisation-password-2' })
    expect(reuse.status).toBe(409)

    expect((await admin.delete(`/api/admin/organisations/${organisation.id}`)).status).toBe(404)
    expect((await admin.patch(`/api/admin/organisations/${organisation.id}`).send({ name: 'X' })).status).toBe(404)
    expect(
      (await admin.put(`/api/admin/organisations/${organisation.id}/password`).send({ password: 'another-password' })).status,
    ).toBe(404)

    expect(await logEntries('delete')).toHaveLength(1)
    const row = await db('Organisation').where({ id: organisation.id }).first()
    expect(row.deletedAt).not.toBeNull()
  })

  it('never stores passwords or hashes in the log', async () => {
    await admin.patch(`/api/admin/organisations/${organisation.id}`).send({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
    await admin.put(`/api/admin/organisations/${organisation.id}/password`).send({ password: 'brand-new-password' })
    await admin.delete(`/api/admin/organisations/${organisation.id}`)
    const entries = await db('AdminActionLog')
    expect(JSON.stringify(entries)).not.toMatch(/brand-new-password|argon2|passwordHash/)
  })
})
