import { existsSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import { agentWithSession, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

let a
let b
let asA

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  ;({ agent: asA } = await agentWithSession({ organisationId: a.id }))
})

describe('DELETE /api/organisation/videos/:id (FR-019, FR-020)', () => {
  it('soft deletes an own video: gone from the library, row and files kept (SC-007)', async () => {
    const video = await createVideoRow({ organisationId: a.id })

    const response = await asA.delete(`/api/organisation/videos/${video.id}`)

    expect(response.status).toBe(204)
    expect((await asA.get('/api/organisation/videos')).body.videos).toEqual([])
    const row = await db('Video').where({ id: video.id }).first()
    expect(row.deletedAt).not.toBeNull()
    expect(existsSync(videoStorage.getPath(row.storageKey))).toBe(true)
    expect(existsSync(videoStorage.getPath(row.thumbnailStorageKey))).toBe(true)
  })

  it('answers 404 to a second delete', async () => {
    const video = await createVideoRow({ organisationId: a.id })
    await asA.delete(`/api/organisation/videos/${video.id}`)
    expect((await asA.delete(`/api/organisation/videos/${video.id}`)).status).toBe(404)
  })

  it('answers 404 for a video of another organisation and leaves it unchanged (FR-022)', async () => {
    const ofB = await createVideoRow({ organisationId: b.id, name: 'Video van B' })
    const response = await asA.delete(`/api/organisation/videos/${ofB.id}?organisationId=${b.id}`).send({ organisationId: b.id })
    expect(response.status).toBe(404)
    expect((await db('Video').where({ id: ofB.id }).first()).deletedAt).toBeNull()
  })

  it('answers 404 for an unknown or malformed id', async () => {
    for (const id of [999999, 'abc', '0']) {
      expect((await asA.delete(`/api/organisation/videos/${id}`)).status, `id ${id}`).toBe(404)
    }
  })

  it('is part of the isolation check: DELETE of B\'s video by A changes nothing (SC-005)', async () => {
    const ofB = await createVideoRow({ organisationId: b.id })
    const asB = (await agentWithSession({ organisationId: b.id })).agent
    await asA.delete(`/api/organisation/videos/${ofB.id}`)
    expect((await asB.get('/api/organisation/videos')).body.videos.map((v) => v.id)).toEqual([ofB.id])
  })
})
