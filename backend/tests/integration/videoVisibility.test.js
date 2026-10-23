import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

// Who sees which video (specs/003 data-model.md § Zichtbaarheid, SC-001, SC-002).
// A owns a public, a selective (for B) and a private video; B is chosen, C is not.

let a
let b
let c
let as
let videos

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  videos = {
    public: await createVideoRow({ organisationId: a.id, name: 'Algemeen', visibility: 'public', description: 'Voor iedereen' }),
    selective: await createVideoRow({
      organisationId: a.id,
      name: 'Selectief',
      visibility: 'selective',
      accessOrganisationIds: [b.id],
    }),
    private: await createVideoRow({ organisationId: a.id, name: 'Privé', visibility: 'private' }),
  }
  as = {
    a: (await agentWithSession({ organisationId: a.id })).agent,
    b: (await agentWithSession({ organisationId: b.id })).agent,
    c: (await agentWithSession({ organisationId: c.id })).agent,
  }
})

const EXPECTED = {
  a: ['public', 'selective', 'private'],
  b: ['public', 'selective'],
  c: ['public'],
}

const namesOf = async (agent) => (await agent.get('/api/organisation/videos')).body.videos.map((v) => v.name).sort()

describe('library (FR-008, FR-009, FR-006)', () => {
  it('shows each organisation exactly the videos available to it', async () => {
    for (const [who, kinds] of Object.entries(EXPECTED)) {
      const expected = kinds.map((kind) => videos[kind].name).sort()
      expect(await namesOf(as[who]), who).toEqual(expected)
    }
  })

  it('marks the owner and shows the availability only to the owner', async () => {
    const ofA = (await as.a.get('/api/organisation/videos')).body.videos
    for (const video of ofA) {
      expect(video.owner).toEqual({ id: a.id, name: 'Zwembad A', isOwn: true })
      expect(video).toHaveProperty('visibility')
    }
    const ofB = (await as.b.get('/api/organisation/videos')).body.videos
    for (const video of ofB) {
      expect(video.owner).toEqual({ id: a.id, name: 'Zwembad A', isOwn: false })
      expect(video).not.toHaveProperty('visibility')
      expect(video).not.toHaveProperty('accessOrganisations')
    }
    expect(ofB.find((v) => v.name === 'Algemeen').description).toBe('Voor iedereen')
  })

  it('hides the videos of a deleted owner from everyone else (FR-010)', async () => {
    await db('Organisation').where({ id: a.id }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
    expect(await namesOf(as.b)).toEqual([])
    expect(await namesOf(as.c)).toEqual([])
  })

  it('shows a soft-deleted video to nobody', async () => {
    await db('Video').where({ id: videos.public.id }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
    for (const who of ['a', 'b', 'c']) expect(await namesOf(as[who])).not.toContain('Algemeen')
  })
})

describe('details and thumbnail (FR-012, FR-013)', () => {
  it('answers 200 for visible and 404 for every other video, like an unknown id', async () => {
    for (const [who, kinds] of Object.entries(EXPECTED)) {
      for (const kind of ['public', 'selective', 'private']) {
        const id = videos[kind].id
        const visible = kinds.includes(kind)
        const details = await as[who].get(`/api/organisation/videos/${id}`)
        const thumbnail = await as[who].get(`/api/organisation/videos/${id}/thumbnail`)
        expect(details.status, `${who} details ${kind}`).toBe(visible ? 200 : 404)
        expect(thumbnail.status, `${who} thumbnail ${kind}`).toBe(visible ? 200 : 404)
        if (visible) expect(thumbnail.headers['content-type']).toBe('image/jpeg')
        else expect(details.body).toEqual((await as[who].get('/api/organisation/videos/999999')).body)
      }
    }
  })

  it('gives the owner the chosen organisations, and others nothing about sharing (FR-006)', async () => {
    const ofA = await as.a.get(`/api/organisation/videos/${videos.selective.id}`)
    expect(ofA.body).toMatchObject({ visibility: 'selective', accessOrganisations: [{ id: b.id, name: 'Zwembad B' }] })

    const ofB = await as.b.get(`/api/organisation/videos/${videos.selective.id}`)
    expect(ofB.body).not.toHaveProperty('visibility')
    expect(ofB.body).not.toHaveProperty('accessOrganisations')
    expect(ofB.body.owner).toEqual({ id: a.id, name: 'Zwembad A', isOwn: false })
  })

  it('shows an empty list when every chosen organisation was deleted', async () => {
    await db('Organisation').where({ id: b.id }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
    const ofA = await as.a.get(`/api/organisation/videos/${videos.selective.id}`)
    expect(ofA.body).toMatchObject({ visibility: 'selective', accessOrganisations: [] })
    expect((await as.c.get(`/api/organisation/videos/${videos.selective.id}`)).status).toBe(404)
  })
})
