import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createCourseRow,
  createOrganisationRow,
  createStepRow,
  createVideoRow,
  resetDatabase,
  restrictVideo,
  softDeleteVideo,
} from '../helpers/testApp.js'
import { JPG_BYTES } from '../helpers/images.js'

// A video that the organisation can no longer see stays a normal part of its step, is shown
// only through the organisation's own course, and cannot be picked again (specs/004 FR-016,
// FR-016a, SC-005a, research R5, R5a). The video library itself does not change.

let a
let b
let c
let as
let video
let course
let step

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
  // B shares a video with A; A uses it in a course.
  video = await createVideoRow({ organisationId: b.id, name: 'Zwembad overzicht', visibility: 'selective', accessOrganisationIds: [a.id], durationSeconds: 61 })
  course = await createCourseRow({ organisationId: a.id })
  step = await createStepRow({ versionId: course.versionId, videoId: video.id, isStart: true })
})

const courseUrl = () => `/api/organisation/courses/${course.courseId}`
const thumbnailUrl = (courseId = course.courseId, stepId = step.id, videoId = video.id) =>
  `/api/organisation/courses/${courseId}/steps/${stepId}/videos/${videoId}/thumbnail`
const savedStep = (extra = {}) => ({ id: step.id, stepType: 'video', isStart: true, positionX: 0, positionY: 0, videoId: video.id, ...extra })
const save = (steps) => as.a.put(courseUrl()).send({ name: 'Cursus', description: 'D', steps })

const CASES = {
  'restricted by the owner': () => restrictVideo(video.id),
  'soft deleted by the owner': () => softDeleteVideo(video.id),
}

for (const [label, makeUnavailable] of Object.entries(CASES)) {
  describe(`a video ${label}`, () => {
    beforeEach(async () => {
      await makeUnavailable()
    })

    it('is still in the draft with name, duration and thumbnail, and nothing else', async () => {
      const response = await as.a.get(courseUrl())
      expect(response.status).toBe(200)
      expect(response.body.steps[0].videoId).toBe(video.id)
      expect(response.body.steps[0].video).toEqual({
        id: video.id,
        name: 'Zwembad overzicht',
        durationSeconds: 61,
        thumbnailUrl: thumbnailUrl(),
        available: false,
      })
    })

    it('does not stop the draft from being saved while the step keeps it', async () => {
      const response = await save([savedStep({ positionX: 40 })])
      expect(response.status).toBe(200)
      expect(response.body.steps[0]).toMatchObject({ id: step.id, videoId: video.id, positionX: 40 })
    })

    it('cannot be picked for a new step or another existing step', async () => {
      const other = await createStepRow({ versionId: course.versionId })
      const asNew = await save([savedStep(), { stepType: 'video', isStart: false, positionX: 0, positionY: 0, videoId: video.id }])
      expect(asNew.status).toBe(400)
      expect(asNew.body.error.fields['steps.1.videoId']).toBe('Kies een video uit de bibliotheek.')
      const asOther = await save([savedStep(), { id: other.id, stepType: 'video', isStart: false, positionX: 0, positionY: 0, videoId: video.id }])
      expect(asOther.status).toBe(400)
      expect(asOther.body.error.fields['steps.1.videoId']).toBe('Kies een video uit de bibliotheek.')
    })

    it('cannot come back once its removal is saved', async () => {
      expect((await save([])).status).toBe(200)
      const restored = await save([{ stepType: 'video', isStart: true, positionX: 0, positionY: 0, videoId: video.id }])
      expect(restored.status).toBe(400)
      expect(restored.body.error.fields['steps.0.videoId']).toBe('Kies een video uit de bibliotheek.')
    })

    it('is not in the library, and the library routes give 404 (unchanged)', async () => {
      const library = (await as.a.get('/api/organisation/videos')).body.videos
      expect(library.map((v) => v.id)).not.toContain(video.id)
      expect((await as.a.get(`/api/organisation/videos/${video.id}`)).status).toBe(404)
      expect((await as.a.get(`/api/organisation/videos/${video.id}/thumbnail`)).status).toBe(404)
    })

    it('has its thumbnail served through the course', async () => {
      const response = await as.a.get(thumbnailUrl()).buffer(true)
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('image/jpeg')
      expect(response.headers['cache-control']).toBe('private, max-age=3600')
      expect(Buffer.compare(response.body, JPG_BYTES)).toBe(0)
    })
  })
}

describe('the course thumbnail route', () => {
  it('serves the thumbnail of an available video too', async () => {
    const response = await as.a.get(thumbnailUrl()).buffer(true)
    expect(response.status).toBe(200)
    expect(Buffer.compare(response.body, JPG_BYTES)).toBe(0)
  })

  it('gives 404 to the owner of the video and to any other organisation (SC-005a)', async () => {
    for (const who of ['b', 'c']) {
      const response = await as[who].get(thumbnailUrl())
      expect(response.status, who).toBe(404)
      expect(response.body.error.code).toBe('not_found')
    }
  })

  it('gives 404 once the course is deleted', async () => {
    await db('Course').where({ id: course.courseId }).update({ deletedAt: new Date() })
    expect((await as.a.get(thumbnailUrl())).status).toBe(404)
  })

  it('gives 404 for a question step and a video step without a video', async () => {
    const question = await createStepRow({ versionId: course.versionId, stepType: 'question' })
    const empty = await createStepRow({ versionId: course.versionId })
    expect((await as.a.get(thumbnailUrl(course.courseId, question.id))).status).toBe(404)
    expect((await as.a.get(thumbnailUrl(course.courseId, empty.id))).status).toBe(404)
  })

  it('gives 404 for a step of another course of the same organisation, and for an unknown step', async () => {
    const other = await createCourseRow({ organisationId: a.id })
    const otherStep = await createStepRow({ versionId: other.versionId, videoId: video.id })
    expect((await as.a.get(thumbnailUrl(course.courseId, otherStep.id))).status).toBe(404)
    expect((await as.a.get(thumbnailUrl(course.courseId, 999999))).status).toBe(404)
    expect((await as.a.get(thumbnailUrl(course.courseId, 'abc'))).status).toBe(404)
  })

  it('gives 404 when the video in the URL is not the video of the step', async () => {
    const other = await createVideoRow({ organisationId: a.id })
    expect((await as.a.get(thumbnailUrl(course.courseId, step.id, other.id))).status).toBe(404)
    expect((await as.a.get(thumbnailUrl(course.courseId, step.id, 'abc'))).status).toBe(404)
  })

  it('gives 404 for a video without a thumbnail, with thumbnailUrl null in the draft', async () => {
    await db('Video').where({ id: video.id }).update({ thumbnailStorageKey: null })
    expect((await as.a.get(thumbnailUrl())).status).toBe(404)
    expect((await as.a.get(courseUrl())).body.steps[0].video.thumbnailUrl).toBeNull()
  })
})
