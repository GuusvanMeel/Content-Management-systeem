import { writeFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import * as videoStorage from '../../src/lib/videoStorage.js'
import { agentWithSession, createCourseRow, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

// Which videos a step may get: exactly the videos of the organisation's library (specs/004
// FR-014, FR-015, SC-005, research R5).

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
  as = { a: (await agentWithSession({ organisationId: a.id })).agent }
  videos = {
    own: await createVideoRow({ organisationId: a.id, name: 'Eigen' }),
    bPublic: await createVideoRow({ organisationId: b.id, name: 'B algemeen', visibility: 'public' }),
    bSelectiveForA: await createVideoRow({ organisationId: b.id, name: 'B selectief', visibility: 'selective', accessOrganisationIds: [a.id] }),
    bPrivate: await createVideoRow({ organisationId: b.id, name: 'B eigen', visibility: 'private' }),
    cSelectiveForB: await createVideoRow({ organisationId: c.id, name: 'C selectief', visibility: 'selective', accessOrganisationIds: [b.id] }),
    deleted: await createVideoRow({ organisationId: a.id, name: 'Verwijderd', deletedAt: new Date() }),
  }
})

// Every step in a save request has a key; connections point to keys (specs/005 research R1).
let keyCount = 0
const newKey = () => `k${++keyCount}`
const videoStep = (videoId, extra = {}) => ({ key: newKey(), stepType: 'video', isStart: false, positionX: 0, positionY: 0, videoId, ...extra })
const courseUrlOf = (courseId) => `/api/organisation/courses/${courseId}`
const save = (courseId, steps) => as.a.put(`/api/organisation/courses/${courseId}`).send({ name: 'Cursus', description: 'D', steps })

describe('choosing a video for a new step', () => {
  it('accepts exactly the videos of the library of A (SC-005)', async () => {
    const { courseId } = await createCourseRow({ organisationId: a.id })
    const library = (await as.a.get('/api/organisation/videos')).body.videos.map((v) => v.id).sort()
    expect(library).toEqual([videos.own.id, videos.bPublic.id, videos.bSelectiveForA.id].sort())
    for (const [key, video] of Object.entries(videos)) {
      const response = await save(courseId, [videoStep(video.id)])
      if (library.includes(video.id)) {
        expect(response.status, key).toBe(200)
      } else {
        expect(response.status, key).toBe(400)
        expect(response.body.error.fields['steps.0.videoId']).toBe('Kies een video uit de bibliotheek.')
      }
    }
  })

  it('refuses an id of a video that does not exist', async () => {
    const { courseId } = await createCourseRow({ organisationId: a.id })
    const response = await save(courseId, [videoStep(999999)])
    expect(response.status).toBe(400)
    expect(response.body.error.fields['steps.0.videoId']).toBe('Kies een video uit de bibliotheek.')
  })

  it('saves a video step without a video', async () => {
    const { courseId } = await createCourseRow({ organisationId: a.id })
    const response = await save(courseId, [videoStep(null)])
    expect(response.status).toBe(200)
    expect(response.body.steps[0]).toMatchObject({ stepType: 'video', videoId: null, video: null })
  })

  it('uses one video in several steps and several courses (FR-015)', async () => {
    const first = await createCourseRow({ organisationId: a.id })
    const second = await createCourseRow({ organisationId: a.id })
    expect((await save(first.courseId, [videoStep(videos.bPublic.id), videoStep(videos.bPublic.id)])).status).toBe(200)
    expect((await save(second.courseId, [videoStep(videos.bPublic.id)])).status).toBe(200)
  })
})

describe('video details in the draft', () => {
  it('gives id, name, duration, the course thumbnail route and available: true', async () => {
    const { courseId } = await createCourseRow({ organisationId: a.id })
    const step = (await save(courseId, [videoStep(videos.bPublic.id)])).body.steps[0]
    expect(step.video).toEqual({
      id: videos.bPublic.id,
      name: 'B algemeen',
      durationSeconds: 95,
      thumbnailUrl: `/api/organisation/courses/${courseId}/steps/${step.id}/videos/${videos.bPublic.id}/thumbnail`,
      available: true,
    })
    expect((await as.a.get(`/api/organisation/courses/${courseId}`)).body.steps[0].video).toEqual(step.video)
  })
})

describe('replacing the video of a step', () => {
  it('gives a new thumbnail URL, so a cached old thumbnail is never shown (finding 2)', async () => {
    const { courseId } = await createCourseRow({ organisationId: a.id })
    // Give the second video a thumbnail with other bytes than the first.
    const otherBytes = Buffer.from('another thumbnail')
    await writeFile(videoStorage.getPath(videos.bPublic.thumbnailStorageKey), otherBytes)

    const first = (await save(courseId, [videoStep(videos.own.id)])).body.steps[0]
    const oldUrl = first.video.thumbnailUrl
    const cached = await as.a.get(oldUrl).buffer(true)
    expect(cached.status).toBe(200)
    // The route may be cached by the browser; that is safe only because the URL names the video.
    expect(cached.headers['cache-control']).toBe('private, max-age=3600')

    const replaced = (await save(courseId, [videoStep(videos.bPublic.id, { id: first.id })])).body.steps[0]
    expect(replaced.id).toBe(first.id)
    expect(replaced.video.name).toBe('B algemeen')
    expect(replaced.video.thumbnailUrl).not.toBe(oldUrl)
    expect((await as.a.get(courseUrlOf(courseId))).body.steps[0].video.thumbnailUrl).toBe(replaced.video.thumbnailUrl)

    const fresh = await as.a.get(replaced.video.thumbnailUrl).buffer(true)
    expect(fresh.status).toBe(200)
    expect(Buffer.compare(fresh.body, otherBytes)).toBe(0)
    // The old URL no longer belongs to this step.
    expect((await as.a.get(oldUrl)).status).toBe(404)
  })
})
