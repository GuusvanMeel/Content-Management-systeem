import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createAdmin,
  createCourseRow,
  createOrganisationRow,
  createStepRow,
  createVideoRow,
  newAgent,
  resetDatabase,
} from '../helpers/testApp.js'

// Organisations only see their own courses (specs/004 FR-003, SC-003, research R2).

let a
let b
let as
let course
let videoStepId

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  as = {
    a: (await agentWithSession({ organisationId: a.id })).agent,
    b: (await agentWithSession({ organisationId: b.id })).agent,
  }
  course = await createCourseRow({ organisationId: a.id, name: 'Cursus van A' })
  // A public video, so B could see the video itself in the library.
  const video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  videoStepId = (await createStepRow({ versionId: course.versionId, videoId: video.id, isStart: true })).id
})

const snapshot = async () => ({
  version: await db('CourseVersion').where({ id: course.versionId }).first(),
  steps: await db('CourseStep').where({ courseVersionId: course.versionId }).orderBy('id'),
  course: await db('Course').where({ id: course.courseId }).first(),
})

const payload = { name: 'Overgenomen', description: 'Door B', steps: [] }

describe('another organisation', () => {
  it('gets 404 on every course route of A and changes nothing', async () => {
    const before = await snapshot()
    const base = `/api/organisation/courses/${course.courseId}`
    const responses = [
      await as.b.get(base),
      await as.b.put(base).send(payload),
      await as.b.delete(base),
      await as.b.get(`${base}/steps/${videoStepId}/video-thumbnail`),
    ]
    for (const response of responses) {
      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('not_found')
    }
    expect(await snapshot()).toEqual(before)
  })

  it('the owner can open it', async () => {
    const response = await as.a.get(`/api/organisation/courses/${course.courseId}`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: course.courseId, name: 'Cursus van A', status: 'draft' })
  })
})

describe('invalid ids and sessions', () => {
  it('treats an id that is not a positive whole number as not found', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '12345678901']) {
      expect((await as.a.get(`/api/organisation/courses/${id}`)).status).toBe(404)
    }
  })

  it('needs a session', async () => {
    expect((await newAgent().get(`/api/organisation/courses/${course.courseId}`)).status).toBe(401)
  })

  it('is not for the administrator', async () => {
    const admin = await createAdmin()
    const { agent } = await agentWithSession({ administratorId: admin.id })
    expect((await agent.get(`/api/organisation/courses/${course.courseId}`)).status).toBe(403)
  })
})
