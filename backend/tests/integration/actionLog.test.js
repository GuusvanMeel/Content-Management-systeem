import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createAdmin, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'

let admin
let adminId

beforeEach(async () => {
  await resetDatabase()
  adminId = (await createAdmin('beheer')).id
  admin = (await agentWithSession({ administratorId: adminId })).agent
})

describe('action log (FR-027, FR-028)', () => {
  it('shows entries newest first with administrator and deleted organisations', async () => {
    const created = await admin
      .post('/api/admin/organisations')
      .send({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', password: 'organisation-password-1' })
    await admin.put(`/api/admin/organisations/${created.body.id}/password`).send({ password: 'another-password-1' })
    await admin.delete(`/api/admin/organisations/${created.body.id}`)

    const res = await admin.get('/api/admin/action-log')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ page: 1, pageSize: 50, total: 3 })
    expect(res.body.entries.map((e) => e.action)).toEqual(['delete', 'passwordReset', 'create'])
    expect(res.body.entries[0]).toMatchObject({
      administrator: 'beheer',
      organisation: { id: created.body.id, name: 'Zwembad A', deleted: true },
    })
    expect(res.body.entries[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(res.body.entries[2].details).toEqual({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  })

  it('pages by 50', async () => {
    const organisation = await createOrganisationRow()
    await db('AdminActionLog').insert(
      Array.from({ length: 51 }, () => ({
        administratorId: adminId,
        organisationId: organisation.id,
        action: 'update',
        createdAt: db.raw('UTC_TIMESTAMP()'),
      })),
    )
    const second = await admin.get('/api/admin/action-log?page=2')
    expect(second.body.total).toBe(51)
    expect(second.body.entries).toHaveLength(1)
  })

  it('has no routes to change or delete entries', async () => {
    for (const [method, path] of [
      ['put', '/api/admin/action-log'],
      ['patch', '/api/admin/action-log'],
      ['delete', '/api/admin/action-log'],
      ['delete', '/api/admin/action-log/1'],
      ['put', '/api/admin/action-log/1'],
    ]) {
      expect((await admin[method](path)).status, `${method} ${path}`).toBe(404)
    }
  })

  it('is not visible to organisations', async () => {
    const organisation = await createOrganisationRow()
    const { agent } = await agentWithSession({ organisationId: organisation.id })
    expect((await agent.get('/api/admin/action-log')).status).toBe(403)
  })
})
