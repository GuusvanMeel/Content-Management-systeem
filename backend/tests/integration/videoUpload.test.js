import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../src/config/env.js'
import { db } from '../../src/db/knex.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import {
  agentWithSession,
  app,
  createOrganisationRow,
  resetDatabase,
  sessionRowByToken,
  setLastActivity,
} from '../helpers/testApp.js'
import { createUpload, encodeMetadata, readFixture, sendChunks, UPLOADS_PATH, uploadFixture } from '../helpers/tus.js'

const MESSAGES = {
  video_unsupported_format: "Alleen MP4-video's (H.264) worden ondersteund.",
  video_unsupported_codec: "Alleen MP4-video's (H.264) worden ondersteund. Deze video gebruikt een andere codec.",
  video_not_360: 'Dit is geen 360°-video: het beeld moet twee keer zo breed zijn als hoog (2:1).',
  video_resolution_too_high: 'De resolutie is te hoog: een video mag maximaal 4096×2048 pixels zijn.',
  video_unreadable: 'Dit bestand kan niet gelezen worden. Controleer of het een werkende video is.',
}
const NO_SPACE = 'Er is op dit moment niet genoeg opslagruimte. Neem contact op met de beheerder.'

let a
let b
let asA
let tokenA

async function filesUnder(dir) {
  const full = path.join(config.VIDEOS_DIR, dir)
  if (!existsSync(full)) return []
  return readdir(full, { recursive: true, withFileTypes: true }).then((entries) =>
    entries.filter((e) => e.isFile()).map((e) => e.name),
  )
}

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  ;({ agent: asA, token: tokenA } = await agentWithSession({ organisationId: a.id }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('video upload: valid file', () => {
  it('stores a verified video in several chunks and answers the last PATCH with the video', async () => {
    const { create, last, url } = await uploadFixture(asA, 'valid-512x256.mp4', { chunkSize: 8 * 1024, name: 'Zwembad overzicht' })
    expect(create.status).toBe(201)
    expect(url).toMatch(/^\/api\/organisation\/video-uploads\/[0-9a-f]+$/)
    expect(last.status).toBe(200)

    const { video } = JSON.parse(last.text)
    expect(video).toMatchObject({ name: 'Zwembad overzicht', durationSeconds: 2 })
    expect(video.fileSizeBytes).toBe((await readFixture('valid-512x256.mp4')).length)
    expect(video.thumbnailUrl).toBe(`/api/organisation/videos/${video.id}/thumbnail`)
    expect(new Date(video.uploadedAt).toString()).not.toBe('Invalid Date')

    const row = await db('Video').where({ id: video.id }).first()
    expect(row).toMatchObject({ ownerOrganisationId: a.id, visibility: 'private', description: null, deletedAt: null })
    expect(row.storageKey).toMatch(new RegExp(`^videos/${a.id}/[0-9a-f-]{36}\\.mp4$`))
    expect(row.thumbnailStorageKey).toMatch(new RegExp(`^thumbnails/${a.id}/[0-9a-f-]{36}\\.jpg$`))
    expect(existsSync(videoStorage.getPath(row.storageKey))).toBe(true)
    expect(existsSync(videoStorage.getPath(row.thumbnailStorageKey))).toBe(true)
    expect(await filesUnder('incoming')).toEqual([])
  })

  it('uses the file name without .mp4 when no name is given', async () => {
    const { last } = await uploadFixture(asA, 'valid-512x256.mp4', { filename: 'Duikplank oefening.MP4' })
    expect(JSON.parse(last.text).video.name).toBe('Duikplank oefening')
  })

  it('cuts a file-name based name to 255 characters', async () => {
    const { last } = await uploadFixture(asA, 'valid-512x256.mp4', { filename: `${'x'.repeat(300)}.mp4` })
    expect(JSON.parse(last.text).video.name).toBe('x'.repeat(255))
  })

  it('names a video "Video" when the file name has nothing before .mp4', async () => {
    const { last } = await uploadFixture(asA, 'valid-512x256.mp4', { filename: '.mp4' })
    expect(JSON.parse(last.text).video.name).toBe('Video')
  })

  it('ignores an organisationId sent by the client', async () => {
    const buffer = await readFixture('valid-512x256.mp4')
    const { response, url } = await createUpload(asA, {
      size: buffer.length,
      filename: 'video.mp4',
      extraMetadata: { organisationId: String(b.id) },
    })
    expect(response.status).toBe(201)
    const last = await sendChunks(asA, url, buffer)
    const { video } = JSON.parse(last.text)
    expect((await db('Video').where({ id: video.id }).first()).ownerOrganisationId).toBe(a.id)
  })

  it.each(['valid-silent-1024x512.mp4', 'valid-opus-audio-512x256.mp4', 'valid-4096x2048.mp4'])(
    'accepts %s',
    async (fixture) => {
      const { last } = await uploadFixture(asA, fixture, { chunkSize: 32 * 1024 })
      expect(last.status).toBe(200)
    },
  )
})

describe('video upload: rejected after the upload', () => {
  it.each([
    ['not-360-640x360.mp4', 'video_not_360'],
    ['square-1024x1024.mp4', 'video_not_360'],
    ['too-large-4352x2176.mp4', 'video_resolution_too_high'],
    ['h265-512x256.mp4', 'video_unsupported_codec'],
    ['quicktime-512x256.mp4', 'video_unsupported_format'],
    ['audio-only.mp4', 'video_unreadable'],
    ['corrupt.mp4', 'video_unreadable'],
  ])('%s → 422 %s, nothing stored', async (fixture, code) => {
    const { last } = await uploadFixture(asA, fixture, { chunkSize: 32 * 1024 })
    expect(last.status).toBe(422)
    expect(JSON.parse(last.text)).toEqual({ error: { code, message: MESSAGES[code] } })
    expect(await db('Video').count({ n: '*' }).first()).toEqual({ n: 0 })
    expect(await filesUnder('videos')).toEqual([])
    expect(await filesUnder('thumbnails')).toEqual([])
    expect(await filesUnder('incoming')).toEqual([])
  })
})

describe('video upload: rejected when creating the upload', () => {
  it('refuses a file that does not end in .mp4 (415)', async () => {
    const { response } = await createUpload(asA, { size: 1000, filename: 'clip.mov' })
    expect(response.status).toBe(415)
    expect(response.body.error).toEqual({ code: 'video_unsupported_format', message: MESSAGES.video_unsupported_format })
  })

  it('refuses a file larger than the maximum (413)', async () => {
    const { response } = await createUpload(asA, { size: config.VIDEO_MAX_SIZE_BYTES + 1 })
    expect(response.status).toBe(413)
    expect(response.body.error).toEqual({
      code: 'video_too_large',
      message: `Een video mag maximaal ${config.VIDEO_MAX_SIZE_GB} GB zijn.`,
    })
  })

  it('refuses a name longer than 255 characters (400)', async () => {
    const { response } = await createUpload(asA, { size: 1000, name: 'n'.repeat(256) })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_failed')
    expect(response.body.error.fields.name).toBeTruthy()
  })

  it('refuses an upload when less than the minimum free space would remain (507)', async () => {
    vi.spyOn(videoStorage, 'freeBytes').mockResolvedValue(config.VIDEO_MIN_FREE_SPACE_BYTES + 500)
    const { response } = await createUpload(asA, { size: 1000 })
    expect(response.status).toBe(507)
    expect(response.body.error).toEqual({ code: 'insufficient_storage', message: NO_SPACE })
    expect(await filesUnder('incoming')).toEqual([])
  })

  it('refuses a request without the CSRF header (403)', async () => {
    const response = await request(app)
      .post(UPLOADS_PATH)
      .set('Cookie', `sid=${tokenA}`)
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', '1000')
      .set('Upload-Metadata', encodeMetadata({ filename: 'video.mp4' }))
    expect(response.status).toBe(403)
  })

  it('refuses a request without a session (401)', async () => {
    const response = await request(app)
      .post(UPLOADS_PATH)
      .set('X-Requested-With', 'cms')
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', '1000')
      .set('Upload-Metadata', encodeMetadata({ filename: 'video.mp4' }))
    expect(response.status).toBe(401)
  })
})

describe('video upload: session', () => {
  it('extends the session with every chunk (FR-012)', async () => {
    const buffer = await readFixture('valid-512x256.mp4')
    const { url } = await createUpload(asA, { size: buffer.length })
    await setLastActivity(tokenA, 59)
    await sendChunks(asA, url, buffer, { until: 4096 })
    const row = await sessionRowByToken(tokenA)
    expect(Date.now() - new Date(row.lastActivityAt).getTime()).toBeLessThan(60 * 1000)
  })
})
