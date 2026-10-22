import { existsSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../src/config/env.js'
import { videoMessage } from '../../src/lib/videoMessages.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import { datastore, uploadFilePath } from '../../src/modules/videos/tusServer.js'
import { agentWithSession, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'
import { createUpload, deleteUpload, headUpload, patchChunk, readFixture, sendChunks } from '../helpers/tus.js'

const FIXTURE = 'valid-silent-1024x512.mp4'
const NO_SPACE = videoMessage('insufficient_storage')

let asA
let asB
let buffer
let url
let half

const uploadId = () => url.split('/').pop()
const uploadExists = () => existsSync(uploadFilePath(uploadId())) || existsSync(`${uploadFilePath(uploadId())}.json`)

beforeEach(async () => {
  await resetDatabase()
  const a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  const b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  ;({ agent: asA } = await agentWithSession({ organisationId: a.id }))
  ;({ agent: asB } = await agentWithSession({ organisationId: b.id }))

  buffer = await readFixture(FIXTURE)
  half = Math.floor(buffer.length / 2)
  ;({ url } = await createUpload(asA, { size: buffer.length, filename: FIXTURE }))
  await sendChunks(asA, url, buffer, { chunkSize: 4096, until: half })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resuming an upload', () => {
  it('reports the received bytes and continues from there (FR-007)', async () => {
    const head = await headUpload(asA, url)
    expect(head.status).toBe(200)
    expect(Number(head.headers['upload-offset'])).toBe(half)
    expect(Number(head.headers['upload-length'])).toBe(buffer.length)

    const last = await sendChunks(asA, url, buffer, { startOffset: half, chunkSize: 8192 })
    expect(last.status).toBe(200)
    expect(JSON.parse(last.text).video.name).toBe('valid-silent-1024x512')
  })

  it('refuses a chunk at the wrong offset (409)', async () => {
    const response = await patchChunk(asA, url, 0, buffer.subarray(0, 100))
    expect(response.status).toBe(409)
  })
})

describe('someone else\'s upload', () => {
  it('answers 404 to HEAD, PATCH and DELETE from another organisation and leaves the upload alone', async () => {
    expect((await headUpload(asB, url)).status).toBe(404)
    expect((await patchChunk(asB, url, half, buffer.subarray(half, half + 100))).status).toBe(404)
    expect((await deleteUpload(asB, url)).status).toBe(404)

    expect(uploadExists()).toBe(true)
    expect(Number((await headUpload(asA, url)).headers['upload-offset'])).toBe(half)
  })

  it('answers 404 to an unknown or malformed upload id', async () => {
    expect((await headUpload(asA, '/api/organisation/video-uploads/0123456789abcdef0123456789abcdef')).status).toBe(404)
    expect((await headUpload(asA, '/api/organisation/video-uploads/..%2F..%2Fetc')).status).toBe(404)
  })
})

describe('cancelling and running out of space', () => {
  it('removes the received chunks on DELETE (FR-010)', async () => {
    const response = await deleteUpload(asA, url)
    expect(response.status).toBe(204)
    expect(uploadExists()).toBe(false)
  })

  it('refuses the next chunk when too little space would remain, and removes the upload (FR-004a)', async () => {
    vi.spyOn(videoStorage, 'freeBytes').mockResolvedValue(config.VIDEO_MIN_FREE_SPACE_BYTES + 10)
    const response = await patchChunk(asA, url, half, buffer.subarray(half, half + 100))
    expect(response.status).toBe(507)
    expect(response.body.error).toEqual({ code: 'insufficient_storage', message: NO_SPACE })
    expect(uploadExists()).toBe(false)
  })

  it('turns a disk-full error while writing into 507 and removes the upload', async () => {
    vi.spyOn(datastore, 'writeChunk').mockRejectedValue(Object.assign(new Error('no space left'), { code: 'ENOSPC' }))
    const response = await patchChunk(asA, url, half, buffer.subarray(half, half + 100))
    expect(response.status).toBe(507)
    expect(JSON.parse(response.text).error).toEqual({ code: 'insufficient_storage', message: NO_SPACE })
    expect(uploadExists()).toBe(false)
  })
})
