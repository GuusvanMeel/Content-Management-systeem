import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createAdmin, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'

let admin

beforeEach(async () => {
  await resetDatabase()
  const created = await createAdmin()
  admin = (await agentWithSession({ administratorId: created.id })).agent
})

const valid = { name: 'Zwembad A', loginCode: 'zwembad-a', password: 'organisation-password-1' }

describe('creating organisations (FR-004 – FR-007, FR-027)', () => {
  it('creates an organisation with a generated Quest link code', async () => {
    const res = await admin.post('/api/admin/organisations').send(valid)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
    expect(res.body.questLinkCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
    expect(res.body.questLinkCode).not.toBe(res.body.loginCode)
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('validates name and password', async () => {
    const shortPassword = await admin.post('/api/admin/organisations').send({ ...valid, password: 'a'.repeat(9) })
    expect(shortPassword.status).toBe(400)
    expect(shortPassword.body.error.fields.password).toBeTruthy()

    const blankName = await admin.post('/api/admin/organisations').send({ ...valid, name: '   ' })
    expect(blankName.status).toBe(400)
    expect(blankName.body.error.fields.name).toBeTruthy()

    const badCode = await admin.post('/api/admin/organisations').send({ ...valid, loginCode: '-AB' })
    expect(badCode.status).toBe(400)
    expect(badCode.body.error.fields.loginCode).toBeTruthy()
  })

  it('rejects a code that is already used, case-insensitively and also by deleted organisations', async () => {
    await createOrganisationRow({ loginCode: 'ZWEMBAD-A' })
    const taken = await admin.post('/api/admin/organisations').send(valid)
    expect(taken.status).toBe(409)
    expect(taken.body.error.fields.loginCode).toBe('Deze code is al in gebruik.')

    await createOrganisationRow({ name: 'Weg', loginCode: 'WEG-ORG', deletedAt: new Date() })
    const deleted = await admin.post('/api/admin/organisations').send({ ...valid, loginCode: 'weg-org' })
    expect(deleted.status).toBe(409)
  })

  it('rejects a code that equals a Quest link code', async () => {
    await createOrganisationRow({ loginCode: 'OTHER', questLinkCode: 'ABCD1234' })
    const res = await admin.post('/api/admin/organisations').send({ ...valid, loginCode: 'abcd1234' })
    expect(res.status).toBe(409)
  })

  it('suggests a free code (FR-004a)', async () => {
    const first = await admin.get('/api/admin/organisations/code-suggestion').query({ name: 'Zwembad De Hoven' })
    expect(first.body).toEqual({ loginCode: 'ZWEMBAD-DE-HOVEN' })

    await createOrganisationRow({ loginCode: 'ZWEMBAD-DE-HOVEN' })
    const second = await admin.get('/api/admin/organisations/code-suggestion').query({ name: 'Zwembad De Hoven' })
    expect(second.body).toEqual({ loginCode: 'ZWEMBAD-DE-HOVEN-2' })

    const empty = await admin.get('/api/admin/organisations/code-suggestion').query({ name: '' })
    expect(empty.status).toBe(400)
  })

  it('lists active organisations sorted by name, without hashes', async () => {
    await createOrganisationRow({ name: 'Zeta', loginCode: 'ZETA' })
    await createOrganisationRow({ name: 'Alfa', loginCode: 'ALFA' })
    await createOrganisationRow({ name: 'Verwijderd', loginCode: 'GONE', deletedAt: new Date() })

    const res = await admin.get('/api/admin/organisations')
    expect(res.body.organisations.map((o) => o.name)).toEqual(['Alfa', 'Zeta'])
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/)
  })

  it('writes a create log entry without password', async () => {
    const res = await admin.post('/api/admin/organisations').send(valid)
    const entries = await db('AdminActionLog').where({ organisationId: res.body.id })
    expect(entries).toHaveLength(1)
    expect(entries[0].action).toBe('create')
    expect(String(entries[0].details)).not.toMatch(/password|argon2/i)
  })
})
