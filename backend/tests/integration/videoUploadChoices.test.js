import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../src/config/env.js'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'
import { createUpload, readFixture, sendChunks, uploadFixture } from '../helpers/tus.js'

// Availability and description sent with the upload (specs/003 research R4, contracts/api.md).

const FIXTURE = 'valid-512x256.mp4'

let a
let b
let c
let asA

async function incomingFiles() {
  const dir = path.join(config.VIDEOS_DIR, 'incoming')
  return existsSync(dir) ? readdir(dir) : []
}

async function uploadedVideo(options) {
  const { create, last } = await uploadFixture(asA, FIXTURE, options)
  expect(create.status, create.text).toBe(201)
  expect(last.status, last.text).toBe(200)
  const { video } = JSON.parse(last.text)
  const row = await db('Video').where({ id: video.id }).first()
  const access = (await db('VideoAccess').where({ videoId: video.id }).orderBy('organisationId')).map((r) => r.organisationId)
  return { video, row, access }
}

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  ;({ agent: asA } = await agentWithSession({ organisationId: a.id }))
})

describe('choosing availability when uploading (FR-001, FR-002)', () => {
  it('stores public without VideoAccess rows', async () => {
    const { video, row, access } = await uploadedVideo({ visibility: 'public' })
    expect(row.visibility).toBe('public')
    expect(access).toEqual([])
    expect(video.visibility).toBe('public')
  })

  it('stores selective with one row per chosen organisation', async () => {
    const { row, access } = await uploadedVideo({ visibility: 'selective', accessOrganisationIds: [c.id, b.id] })
    expect(row.visibility).toBe('selective')
    expect(access).toEqual([b.id, c.id].sort((x, y) => x - y))
  })

  it('uses the configured default without a visibility', async () => {
    const { row } = await uploadedVideo({})
    expect(row.visibility).toBe(config.VIDEO_DEFAULT_VISIBILITY)
  })

  it.each([
    ['selective without organisations', { visibility: 'selective' }, 'accessOrganisationIds'],
    ['selective with the own organisation', { visibility: 'selective', accessOrganisationIds: 'OWN' }, 'accessOrganisationIds'],
    ['selective with an unknown id', { visibility: 'selective', accessOrganisationIds: [999999] }, 'accessOrganisationIds'],
    ['an unknown visibility', { visibility: 'onzin' }, 'visibility'],
  ])('refuses %s before the first chunk', async (_label, options, field) => {
    const choices = options.accessOrganisationIds === 'OWN' ? { ...options, accessOrganisationIds: [a.id] } : options
    const buffer = await readFixture(FIXTURE)
    const { response } = await createUpload(asA, { size: buffer.length, ...choices })
    expect(response.status).toBe(400)
    const error = JSON.parse(response.text).error
    expect(error.code).toBe('validation_failed')
    expect(Object.keys(error.fields)).toEqual([field])
    expect(await incomingFiles()).toEqual([])
  })

  it('stores a video as private when every chosen organisation was deleted during the upload (research R4)', async () => {
    const buffer = await readFixture(FIXTURE)
    const { response, url } = await createUpload(asA, {
      size: buffer.length,
      visibility: 'selective',
      accessOrganisationIds: [b.id],
    })
    expect(response.status).toBe(201)
    await sendChunks(asA, url, buffer, { until: buffer.length - 1024 })
    await db('Organisation').where({ id: b.id }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
    const last = await sendChunks(asA, url, buffer, { startOffset: buffer.length - 1024 })

    expect(last.status).toBe(200)
    const { video } = JSON.parse(last.text)
    expect((await db('Video').where({ id: video.id }).first()).visibility).toBe('private')
    expect(await db('VideoAccess').where({ videoId: video.id })).toEqual([])
  })

  it('accepts a large metadata header (description of 1000 four-byte characters)', async () => {
    const description = '😀'.repeat(1000)
    const { row } = await uploadedVideo({ visibility: 'public', description })
    expect(row.description).toBe(description)
  })
})

describe('description when uploading (FR-020, FR-021)', () => {
  it('stores line breaks as \\n and trims', async () => {
    const { row, video } = await uploadedVideo({ description: '  Regel 1\r\nRegel 2  ' })
    expect(row.description).toBe('Regel 1\nRegel 2')
    expect(video.description).toBe('Regel 1\nRegel 2')
  })

  it('stores whitespace only as no description', async () => {
    const { row } = await uploadedVideo({ description: '   ' })
    expect(row.description).toBeNull()
  })

  it('refuses 1001 characters before the first chunk', async () => {
    const buffer = await readFixture(FIXTURE)
    const { response } = await createUpload(asA, { size: buffer.length, description: 'a'.repeat(1001) })
    expect(response.status).toBe(400)
    expect(JSON.parse(response.text).error.fields).toEqual({
      description: 'De beschrijving mag maximaal 1000 tekens zijn.',
    })
    expect(await incomingFiles()).toEqual([])
  })
})
