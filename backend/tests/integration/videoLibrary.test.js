import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../src/config/env.js'
import { seedVideos } from '../../scripts/seed-videos.js'
import { agentWithSession, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { JPG_BYTES } from '../helpers/images.js'

let a
let b
let asA

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  ;({ agent: asA } = await agentWithSession({ organisationId: a.id }))
})

describe('GET /api/organisation/videos', () => {
  it('lists only the own, not deleted videos, newest first, in the contract shape', async () => {
    const older = await createVideoRow({ organisationId: a.id, name: 'Ouder', uploadedAt: new Date('2026-10-20T08:00:00Z') })
    const newer = await createVideoRow({ organisationId: a.id, name: 'Nieuwer', uploadedAt: new Date('2026-10-22T09:14:03Z') })
    await createVideoRow({ organisationId: a.id, name: 'Verwijderd', deletedAt: new Date() })
    await createVideoRow({ organisationId: b.id, name: 'Van B' })

    const response = await asA.get('/api/organisation/videos')

    expect(response.status).toBe(200)
    expect(response.body.videos.map((v) => v.name)).toEqual(['Nieuwer', 'Ouder'])
    expect(response.body.videos[0]).toEqual({
      id: newer.id,
      name: 'Nieuwer',
      durationSeconds: 95,
      fileSizeBytes: 3221225472,
      uploadedAt: '2026-10-22T09:14:03.000Z',
      thumbnailUrl: `/api/organisation/videos/${newer.id}/thumbnail`,
    })
    expect(response.body.videos[1].id).toBe(older.id)
  })

  it('returns an empty list for an organisation without videos', async () => {
    const response = await asA.get('/api/organisation/videos')
    expect(response.body).toEqual({ videos: [] })
  })

  it('shows 200 videos within 2 seconds (SC-006)', async () => {
    await seedVideos(a.loginCode, 200)
    const start = Date.now()
    const response = await asA.get('/api/organisation/videos')
    expect(Date.now() - start).toBeLessThan(2000)
    expect(response.status).toBe(200)
    expect(response.body.videos).toHaveLength(200)
  })
})

describe('GET /api/organisation/videos/:id/thumbnail', () => {
  it('sends the JPEG of an own video (development branch) with the cache header', async () => {
    const video = await createVideoRow({ organisationId: a.id })
    const response = await asA.get(`/api/organisation/videos/${video.id}/thumbnail`)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe('image/jpeg')
    expect(response.headers['cache-control']).toBe('private, max-age=3600')
    expect(Buffer.compare(response.body, JPG_BYTES)).toBe(0)
  })

  it('answers 404 for a video of another organisation, a deleted, an unknown and a malformed id', async () => {
    const ofB = await createVideoRow({ organisationId: b.id })
    const deleted = await createVideoRow({ organisationId: a.id, deletedAt: new Date() })
    for (const id of [ofB.id, deleted.id, 999999, 'abc', '1.5', '-1']) {
      const response = await asA.get(`/api/organisation/videos/${id}/thumbnail`)
      expect(response.status, `id ${id}`).toBe(404)
    }
  })
})

describe('GET /api/organisation/videos/upload-settings', () => {
  it('returns the limits from the configuration', async () => {
    const response = await asA.get('/api/organisation/videos/upload-settings')
    expect(response.body).toEqual({
      maxFileSizeBytes: config.VIDEO_MAX_SIZE_BYTES,
      maxWidth: 5760,
      maxHeight: 2880,
      maxParallelUploads: config.VIDEO_MAX_PARALLEL_UPLOADS,
      chunkSizeBytes: 32 * 1024 * 1024,
      acceptedExtensions: ['.mp4'],
      uploadEndpoint: '/api/organisation/video-uploads',
    })
  })
})
