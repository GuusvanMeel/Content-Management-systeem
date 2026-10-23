import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

// PATCH /api/organisation/videos/:id (specs/003 contracts/api.md, FR-012a, FR-014 – FR-017, SC-003).

let a
let b
let c
let as

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  as = {
    a: (await agentWithSession({ organisationId: a.id })).agent,
    b: (await agentWithSession({ organisationId: b.id })).agent,
    c: (await agentWithSession({ organisationId: c.id })).agent,
  }
})

const patch = (who, id, body) => as[who].patch(`/api/organisation/videos/${id}`).send(body)
const accessOf = async (id) => (await db('VideoAccess').where({ videoId: id }).orderBy('organisationId')).map((r) => r.organisationId)
const sees = async (who, id) => (await as[who].get('/api/organisation/videos')).body.videos.some((v) => v.id === id)

describe('changing name and description (FR-015, FR-016)', () => {
  it('renames, and other organisations see the new name', async () => {
    const video = await createVideoRow({ organisationId: a.id, name: 'Oud', visibility: 'public' })
    const response = await patch('a', video.id, { name: '  Nieuw  ' })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: video.id, name: 'Nieuw', visibility: 'public', owner: { isOwn: true } })
    expect((await as.b.get(`/api/organisation/videos/${video.id}`)).body.name).toBe('Nieuw')
  })

  it('changes and empties the description', async () => {
    const video = await createVideoRow({ organisationId: a.id, description: 'Oud' })
    expect((await patch('a', video.id, { description: 'Regel 1\r\nRegel 2' })).body.description).toBe('Regel 1\nRegel 2')
    expect((await patch('a', video.id, { description: '' })).body.description).toBeNull()
    await patch('a', video.id, { description: 'Weer iets' })
    expect((await patch('a', video.id, { description: null })).body.description).toBeNull()
  })

  it('refuses invalid values with the field that is wrong', async () => {
    const video = await createVideoRow({ organisationId: a.id })
    const cases = [
      [{}, 'name'],
      [{ name: '  ' }, 'name'],
      [{ name: 'x'.repeat(256) }, 'name'],
      [{ description: 'a'.repeat(1001) }, 'description'],
      [{ visibility: 'onzin' }, 'visibility'],
      [{ visibility: 'selective' }, 'accessOrganisationIds'],
      [{ visibility: 'selective', accessOrganisationIds: [] }, 'accessOrganisationIds'],
      [{ visibility: 'selective', accessOrganisationIds: [a.id] }, 'accessOrganisationIds'],
      [{ visibility: 'selective', accessOrganisationIds: [999999] }, 'accessOrganisationIds'],
    ]
    for (const [body, field] of cases) {
      const response = await patch('a', video.id, body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(Object.keys(response.body.error.fields), JSON.stringify(body)).toEqual([field])
    }
    expect((await patch('a', video.id, { name: '  ' })).body.error.fields.name).toBe('Vul een naam in.')
    expect((await db('Video').where({ id: video.id }).first()).visibility).toBe('private')
  })
})

describe('changing availability (FR-007, FR-017, SC-003)', () => {
  it('public → selective for B: C loses access at once, B keeps it', async () => {
    const video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
    expect(await sees('c', video.id)).toBe(true)

    const response = await patch('a', video.id, { visibility: 'selective', accessOrganisationIds: [b.id] })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ visibility: 'selective', accessOrganisations: [{ id: b.id, name: 'Zwembad B' }] })

    expect(await sees('c', video.id)).toBe(false)
    expect((await as.c.get(`/api/organisation/videos/${video.id}`)).status).toBe(404)
    expect((await as.c.get(`/api/organisation/videos/${video.id}/thumbnail`)).status).toBe(404)
    expect(await sees('b', video.id)).toBe(true)
  })

  it('selective B+C → only B: C loses access', async () => {
    const video = await createVideoRow({ organisationId: a.id, visibility: 'selective', accessOrganisationIds: [b.id, c.id] })
    await patch('a', video.id, { accessOrganisationIds: [b.id] })
    expect(await accessOf(video.id)).toEqual([b.id])
    expect(await sees('c', video.id)).toBe(false)
    expect(await sees('b', video.id)).toBe(true)
  })

  it('removes every chosen organisation when leaving selective', async () => {
    for (const next of ['private', 'public']) {
      const video = await createVideoRow({ organisationId: a.id, visibility: 'selective', accessOrganisationIds: [b.id, c.id] })
      const response = await patch('a', video.id, { visibility: next })
      expect(response.status).toBe(200)
      expect(response.body).not.toHaveProperty('accessOrganisations')
      expect(await accessOf(video.id)).toEqual([])
    }
  })

  it('private → public makes the video visible to everyone', async () => {
    const video = await createVideoRow({ organisationId: a.id, visibility: 'private' })
    await patch('a', video.id, { visibility: 'public' })
    expect(await sees('b', video.id)).toBe(true)
    expect(await sees('c', video.id)).toBe(true)
  })
})

describe('only the owner may change a video (FR-014, SC-002)', () => {
  it('refuses a visible video of another organisation with 403 and changes nothing', async () => {
    const video = await createVideoRow({ organisationId: a.id, name: 'Van A', visibility: 'public' })
    for (const body of [{ name: 'Gekaapt' }, { visibility: 'private' }, { description: 'x' }]) {
      const response = await patch('b', video.id, body)
      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('not_owner')
    }
    const row = await db('Video').where({ id: video.id }).first()
    expect(row).toMatchObject({ name: 'Van A', visibility: 'public', description: null })
  })

  it('answers 404 for a video the organisation cannot see', async () => {
    const video = await createVideoRow({ organisationId: a.id, visibility: 'selective', accessOrganisationIds: [b.id] })
    expect((await patch('c', video.id, { name: 'Gekaapt' })).status).toBe(404)
    expect((await patch('a', 999999, { name: 'X' })).status).toBe(404)
  })

  it('never takes an owner from the request', async () => {
    const video = await createVideoRow({ organisationId: a.id })
    await patch('a', video.id, { name: 'Nieuw', ownerOrganisationId: b.id, organisationId: b.id })
    expect((await db('Video').where({ id: video.id }).first()).ownerOrganisationId).toBe(a.id)
  })
})
