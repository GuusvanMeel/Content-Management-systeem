import { beforeEach, describe, expect, it } from 'vitest'
import { agentWithSession, createAdmin, createOrganisationRow, newAgent, resetDatabase } from '../helpers/testApp.js'

beforeEach(resetDatabase)

describe('GET /api/organisation/organisations (specs/003 FR-004)', () => {
  it('lists the other active organisations by name, with only id and name', async () => {
    const a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
    const c = await createOrganisationRow({ name: 'Brandweer C', loginCode: 'BRANDWEER-C' })
    const b = await createOrganisationRow({ name: 'Duikschool B', loginCode: 'DUIKSCHOOL-B' })
    await createOrganisationRow({ name: 'Weg D', loginCode: 'WEG-D', deletedAt: new Date() })

    const { agent } = await agentWithSession({ organisationId: a.id })
    const response = await agent.get('/api/organisation/organisations')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      organisations: [
        { id: c.id, name: 'Brandweer C' },
        { id: b.id, name: 'Duikschool B' },
      ],
    })
  })

  it('needs an organisation session', async () => {
    expect((await newAgent().get('/api/organisation/organisations')).status).toBe(401)
    const admin = await createAdmin()
    const { agent } = await agentWithSession({ administratorId: admin.id })
    expect((await agent.get('/api/organisation/organisations')).status).toBe(403)
  })
})
