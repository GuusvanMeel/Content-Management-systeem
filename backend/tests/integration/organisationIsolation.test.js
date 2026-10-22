import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { createUpload, headUpload, patchChunk, readFixture, sendChunks } from '../helpers/tus.js'

// Every route under /api/organisation (contracts/api.md). New organisation routes are added here.
const ORGANISATION_ROUTES = [
  ['get', '/api/organisation'],
  ['get', '/api/organisation/style'],
  ['put', '/api/organisation/style'],
  ['put', '/api/organisation/style/logo'],
  ['delete', '/api/organisation/style/logo'],
  ['delete', '/api/organisation/style'],
  ['get', '/api/organisation/videos'],
  ['get', '/api/organisation/videos/upload-settings'],
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

  it('never shows, changes or continues videos and uploads of another organisation (SC-005)', async () => {
    const videoOfB = await createVideoRow({ organisationId: b.id, name: 'Video van B' })
    const asB = (await agentWithSession({ organisationId: b.id })).agent
    const buffer = await readFixture('valid-512x256.mp4')
    const { url: uploadOfB } = await createUpload(asB, { size: buffer.length, filename: 'b.mp4' })
    await sendChunks(asB, uploadOfB, buffer, { until: 1024 })

    // Routes that take a video or upload of B (contracts/api.md). DELETE /videos/:id is
    // added in the delete tests (videoDelete.test.js), where that route is introduced.
    const attempts = [
      () => asA.get(`/api/organisation/videos?organisationId=${b.id}`),
      () => asA.get(`/api/organisation/videos/${videoOfB.id}/thumbnail`),
      () => headUpload(asA, uploadOfB),
      () => patchChunk(asA, uploadOfB, 1024, buffer.subarray(1024, 2048)),
      () => asA.delete(uploadOfB).set('Tus-Resumable', '1.0.0'),
    ]
    for (const attempt of attempts) {
      const res = await attempt()
      expect(res.status).toBeLessThan(500)
      expect(res.text ?? '').not.toMatch(/Video van B/)
      if (res.status !== 200) expect(res.status).toBe(404)
    }

    expect((await asA.get('/api/organisation/videos')).body.videos).toEqual([])
    expect((await db('Video').where({ id: videoOfB.id }).first()).deletedAt).toBeNull()
    expect(Number((await headUpload(asB, uploadOfB)).headers['upload-offset'])).toBe(1024)

    // A new upload by A always belongs to A, whatever organisationId it sends.
    const { url } = await createUpload(asA, {
      size: buffer.length,
      filename: 'a.mp4',
      extraMetadata: { organisationId: String(b.id) },
    })
    const last = await sendChunks(asA, url, buffer)
    const { video } = JSON.parse(last.text)
    expect((await db('Video').where({ id: video.id }).first()).ownerOrganisationId).toBe(a.id)
  })
})
