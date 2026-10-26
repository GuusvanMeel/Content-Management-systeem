import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createCourseRow,
  createOrganisationRow,
  createStepRow,
  resetDatabase,
} from '../helpers/testApp.js'

// Creating and listing courses (specs/004 US1, FR-001 – FR-004, research R1, R6).

let a
let b
let as

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  as = {
    a: (await agentWithSession({ organisationId: a.id })).agent,
    b: (await agentWithSession({ organisationId: b.id })).agent,
  }
})

const create = (who, body) => as[who].post('/api/organisation/courses').send(body)
const list = async (who) => (await as[who].get('/api/organisation/courses')).body.courses

describe('creating a course (FR-001, FR-002)', () => {
  it('creates the course, its owner row and its draft, and returns the empty draft', async () => {
    const response = await create('a', { name: '  Redding  ', description: ' Diep bad \r\n' })
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ name: 'Redding', description: 'Diep bad', status: 'draft', steps: [] })
    const id = response.body.id
    expect(await db('Course').where({ id }).first()).toMatchObject({ parentCourseId: null, isSharedInLibrary: 0, deletedAt: null })
    expect(await db('OrganisationCourse').where({ courseId: id })).toEqual([
      expect.objectContaining({ organisationId: a.id, isOwner: 1 }),
    ])
    expect(await db('CourseVersion').where({ courseId: id })).toEqual([
      expect.objectContaining({ versionNumber: 1, name: 'Redding', description: 'Diep bad', publishedAt: null }),
    ])
  })

  it('never takes the organisation from the request', async () => {
    const response = await create('a', { name: 'X', description: 'Y', organisationId: b.id })
    expect((await db('OrganisationCourse').where({ courseId: response.body.id }).first()).organisationId).toBe(a.id)
  })

  it('requires a name and a description', async () => {
    for (const body of [{ name: '', description: 'Y' }, { name: 'X', description: '   ' }, {}]) {
      const response = await create('a', body)
      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('validation_failed')
      expect(Object.values(response.body.error.fields)).toContain('Vul een naam en een beschrijving in.')
    }
    expect(await db('Course').count({ n: '*' }).first()).toEqual({ n: 0 })
  })

  it('limits the name to 255 and the description to 1000 characters', async () => {
    expect((await create('a', { name: 'a'.repeat(256), description: 'Y' })).body.error.fields.name).toBe(
      'De naam mag maximaal 255 tekens lang zijn.',
    )
    expect((await create('a', { name: 'X', description: 'b'.repeat(1001) })).body.error.fields.description).toBe(
      'De beschrijving mag maximaal 1000 tekens zijn.',
    )
    expect((await create('a', { name: 'a'.repeat(255), description: 'b'.repeat(1000) })).status).toBe(201)
  })

  it('opens the new course right away', async () => {
    const { id } = (await create('a', { name: 'X', description: 'Y' })).body
    expect((await as.a.get(`/api/organisation/courses/${id}`)).body).toMatchObject({ id, name: 'X', steps: [] })
  })
})

describe('the course list (FR-004)', () => {
  it('lists own courses, newest change first, with step counts and status', async () => {
    const old = await createCourseRow({ organisationId: a.id, name: 'Oud', updatedAt: new Date('2026-01-01T00:00:00Z') })
    const recent = await createCourseRow({ organisationId: a.id, name: 'Nieuw', updatedAt: new Date('2026-06-01T00:00:00Z') })
    await createStepRow({ versionId: old.versionId, stepType: 'video' })
    await createStepRow({ versionId: old.versionId, stepType: 'video' })
    await createStepRow({ versionId: old.versionId, stepType: 'question' })
    expect(await list('a')).toEqual([
      { id: recent.courseId, name: 'Nieuw', updatedAt: '2026-06-01T00:00:00.000Z', videoStepCount: 0, questionStepCount: 0, status: 'draft' },
      { id: old.courseId, name: 'Oud', updatedAt: '2026-01-01T00:00:00.000Z', videoStepCount: 2, questionStepCount: 1, status: 'draft' },
    ])
  })

  it('leaves out deleted courses', async () => {
    await createCourseRow({ organisationId: a.id, name: 'Weg', deletedAt: new Date() })
    expect(await list('a')).toEqual([])
  })

  it('shows another organisation nothing of A (SC-003)', async () => {
    await createCourseRow({ organisationId: a.id })
    await create('a', { name: 'Ook van A', description: 'Y' })
    expect(await list('b')).toEqual([])
    expect(await list('a')).toHaveLength(2)
  })

  it('puts a course that was just saved on top', async () => {
    const first = await createCourseRow({ organisationId: a.id, name: 'Eerst', updatedAt: new Date('2026-01-01T00:00:00Z') })
    await createCourseRow({ organisationId: a.id, name: 'Later', updatedAt: new Date('2026-02-01T00:00:00Z') })
    await as.a.put(`/api/organisation/courses/${first.courseId}`).send({ name: 'Eerst', description: 'D', steps: [] })
    expect((await list('a')).map((c) => c.name)).toEqual(['Eerst', 'Later'])
  })
})
