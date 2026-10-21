import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'

// Every route under /api/organisation (contracts/api.md). New organisation routes are added here.
const ORGANISATION_ROUTES = [
  ['get', '/api/organisation'],
  ['get', '/api/organisation/style'],
  ['put', '/api/organisation/style'],
  ['put', '/api/organisation/style/logo'],
  ['delete', '/api/organisation/style/logo'],
  ['delete', '/api/organisation/style'],
]

const ADMIN_ROUTES = (id) => [
  ['get', '/api/admin/organisations'],
  ['get', '/api/admin/organisations/code-suggestion?name=X'],
  ['get', `/api/admin/organisations/${id}`],
  ['post', '/api/admin/organisations'],
  ['patch', `/api/admin/organisations/${id}`],
  ['put', `/api/admin/organisations/${id}/password`],
  ['delete', `/api/admin/organisations/${id}`],
  ['get', '/api/admin/action-log'],
]

let a
let b
let asA

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Organisatie A', loginCode: 'ORG-A' })
  b = await createOrganisationRow({ name: 'Organisatie B', loginCode: 'ORG-B' })
  await db('OrganisationStyle').insert({ organisationId: b.id, primaryColour: '#112233', secondaryColour: '#445566' })
  asA = (await agentWithSession({ organisationId: a.id })).agent
})

describe('isolation between organisations (FR-021, FR-022, SC-003, SC-004)', () => {
  it('never returns or changes data of another organisation, however the request is built', async () => {
    const styleOfB = await db('OrganisationStyle').where({ organisationId: b.id }).first()

    for (const [method, path] of ORGANISATION_ROUTES) {
      const res = await asA[method](`${path}?organisationId=${b.id}&id=${b.id}`).send({
        organisationId: b.id,
        id: b.id,
        primaryColour: '#ABCDEF',
      })
      expect(res.status, `${method} ${path}`).toBeLessThan(500)
      expect(JSON.stringify(res.body), `${method} ${path}`).not.toMatch(/Organisatie B|ORG-B|#112233/)
    }

    expect(await db('OrganisationStyle').where({ organisationId: b.id }).first()).toEqual(styleOfB)
    const self = await asA.get(`/api/organisation?organisationId=${b.id}`)
    expect(self.body.id).toBe(a.id)
  })

  it('refuses every admin route to an organisation', async () => {
    for (const [method, path] of ADMIN_ROUTES(b.id)) {
      const res = await asA[method](path).send({ name: 'Gekaapt', password: 'x'.repeat(12) })
      expect(res.status, `${method} ${path}`).toBe(403)
    }
    expect((await db('Organisation').where({ id: b.id }).first()).name).toBe('Organisatie B')
  })
})
