import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createCourseRow,
  createOrganisationRow,
  createStepRow,
  createVideoRow,
  resetDatabase,
} from '../helpers/testApp.js'

// PUT /api/organisation/courses/:id: saving the whole draft at once (specs/004 FR-009,
// research R3, data-model.md § Opslaan, SC-002, SC-004).

let a
let agent
let course
let video

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
  course = await createCourseRow({ organisationId: a.id, name: 'Redding', description: 'Diep bad', updatedAt: new Date('2026-01-01T00:00:00Z') })
  video = await createVideoRow({ organisationId: a.id })
})

const url = () => `/api/organisation/courses/${course.courseId}`
const put = (body) => agent.put(url()).send(body)
const answers = (...texts) => texts.map((answerText, i) => ({ answerText, isCorrect: i === 0 }))
const videoStep = (extra = {}) => ({ stepType: 'video', isStart: false, positionX: 0, positionY: 0, videoId: null, ...extra })
const questionStep = (extra = {}) => ({
  stepType: 'question',
  isStart: false,
  positionX: 0,
  positionY: 200,
  questionText: 'Wat doe je eerst?',
  feedback: null,
  answers: answers('Alarmeren', 'Springen'),
  ...extra,
})
const body = (steps, extra = {}) => ({ name: 'Redding', description: 'Diep bad', steps, ...extra })
const stepRows = () => db('CourseStep').where({ courseVersionId: course.versionId }).orderBy('id')
const answerRows = () => db('Answer').orderBy(['courseStepId', 'sortOrder'])
const dbState = async () => ({
  version: await db('CourseVersion').where({ id: course.versionId }).first(),
  course: await db('Course').where({ id: course.courseId }).first(),
  steps: await stepRows(),
  answers: await answerRows(),
})

describe('creating, updating and deleting steps', () => {
  it('creates steps without an id and returns the saved draft with ids', async () => {
    const response = await put(body([videoStep({ isStart: true, videoId: video.id, positionX: 10, positionY: 20 }), questionStep()]))
    expect(response.status).toBe(200)
    const [first, second] = response.body.steps
    expect(first).toMatchObject({ stepType: 'video', isStart: true, videoId: video.id, positionX: 10, positionY: 20 })
    expect(first.id).toEqual(expect.any(Number))
    expect(second).toMatchObject({ stepType: 'question', isStart: false, questionText: 'Wat doe je eerst?', feedback: null })
    expect(second.answers).toEqual([
      { id: expect.any(Number), answerText: 'Alarmeren', isCorrect: true },
      { id: expect.any(Number), answerText: 'Springen', isCorrect: false },
    ])
    expect(response.body).toMatchObject({ id: course.courseId, name: 'Redding', description: 'Diep bad', status: 'draft' })
    expect(await stepRows()).toHaveLength(2)
  })

  it('updates steps and answers that keep their id', async () => {
    const saved = (await put(body([questionStep()]))).body.steps[0]
    const [first, second] = saved.answers
    const response = await put(
      body([
        questionStep({
          id: saved.id,
          isStart: true,
          positionX: 5,
          questionText: 'Wat nu?',
          answers: [
            { id: second.id, answerText: 'Springen', isCorrect: true },
            { id: first.id, answerText: 'Alarmeren', isCorrect: false },
          ],
        }),
      ]),
    )
    expect(response.status).toBe(200)
    expect(response.body.steps).toEqual([
      expect.objectContaining({
        id: saved.id,
        isStart: true,
        positionX: 5,
        questionText: 'Wat nu?',
        answers: [
          { id: second.id, answerText: 'Springen', isCorrect: true },
          { id: first.id, answerText: 'Alarmeren', isCorrect: false },
        ],
      }),
    ])
    expect((await answerRows()).map((row) => [row.id, row.sortOrder])).toEqual([
      [second.id, 0],
      [first.id, 1],
    ])
  })

  it('deletes steps and answers that are not in the request', async () => {
    const saved = (await put(body([videoStep(), questionStep({ answers: answers('A', 'B', 'C') })]))).body.steps
    const question = saved[1]
    const response = await put(
      body([questionStep({ id: question.id, answers: question.answers.slice(0, 2).map(({ id, answerText }, i) => ({ id, answerText, isCorrect: i === 0 })) })]),
    )
    expect(response.status).toBe(200)
    expect((await stepRows()).map((row) => row.id)).toEqual([question.id])
    expect((await answerRows()).map((row) => row.id)).toEqual(question.answers.slice(0, 2).map((x) => x.id))
  })

  it('makes no duplicates when the same request is sent again without the new ids', async () => {
    const request = body([videoStep({ isStart: true }), questionStep()])
    expect((await put(request)).status).toBe(200)
    const again = await put(request)
    expect(again.status).toBe(200)
    expect(again.body.steps).toHaveLength(2)
    expect(await stepRows()).toHaveLength(2)
    expect(await answerRows()).toHaveLength(2)
  })

  it('saves name and description and moves updatedAt', async () => {
    const response = await put(body([], { name: '  Nieuwe naam ', description: 'Nieuw' }))
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ name: 'Nieuwe naam', description: 'Nieuw' })
    const row = await db('Course').where({ id: course.courseId }).first()
    expect(row.updatedAt.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00Z').getTime())
    expect(new Date(response.body.updatedAt).getTime()).toBe(row.updatedAt.getTime())
  })

  it('keeps description and next-step fields empty (FR-017, FR-019)', async () => {
    await put(body([videoStep({ description: 'x', nextCourseStepId: 1 }), questionStep({ answers: [
      { answerText: 'A', isCorrect: true, nextCourseStepId: 1 },
      { answerText: 'B', isCorrect: false },
    ] })]))
    for (const row of await stepRows()) {
      expect(row.description).toBeNull()
      expect(row.nextCourseStepId).toBeNull()
    }
    for (const row of await answerRows()) expect(row.nextCourseStepId).toBeNull()
  })

  it('lets the last save win', async () => {
    await put(body([videoStep()], { name: 'Eerste' }))
    await put(body([questionStep()], { name: 'Tweede' }))
    const response = await agent.get(url())
    expect(response.body.name).toBe('Tweede')
    expect(response.body.steps.map((s) => s.stepType)).toEqual(['question'])
  })
})

describe('question steps (US3, FR-013, FR-017)', () => {
  it('saves an empty question with empty answers', async () => {
    const response = await put(body([questionStep({ questionText: '', answers: [{ answerText: '', isCorrect: true }, { answerText: '', isCorrect: false }] })]))
    expect(response.status).toBe(200)
    expect(response.body.steps[0]).toMatchObject({ questionText: '', answers: [{ answerText: '' }, { answerText: '' }] })
    expect((await stepRows())[0].questionText).toBe('')
  })

  it('keeps feedback, and stores empty feedback as null', async () => {
    const saved = (await put(body([questionStep({ feedback: 'Eerst alarmeren.' })]))).body.steps[0]
    expect(saved.feedback).toBe('Eerst alarmeren.')
    const emptied = (await put(body([questionStep({ id: saved.id, feedback: '  ', answers: saved.answers })]))).body.steps[0]
    expect(emptied.feedback).toBeNull()
    expect((await stepRows())[0].feedback).toBeNull()
  })

  it('stores the answers in the order of the request (sortOrder 0–3)', async () => {
    await put(body([questionStep({ answers: answers('A', 'B', 'C', 'D') })]))
    expect((await answerRows()).map((row) => [row.answerText, row.sortOrder])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
      ['D', 3],
    ])
  })

  it('refuses feedback on a video step', async () => {
    const response = await put(body([videoStep({ feedback: 'Goed zo' })]))
    expect(response.status).toBe(400)
    expect(response.body.error.fields['steps.0.stepType']).toBe('Een video-onderdeel heeft geen vraag, antwoorden of feedback.')
  })
})

describe('rejected requests change nothing (SC-004)', () => {
  let existing

  beforeEach(async () => {
    existing = await createStepRow({ versionId: course.versionId, stepType: 'question', isStart: true })
  })

  const expectRejected = async (request, field, message) => {
    const before = await dbState()
    const response = await put(request)
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_failed')
    expect(response.body.error.fields[field]).toBe(message)
    expect(await dbState()).toEqual(before)
  }

  it('rejects a step id that does not belong to this course', async () => {
    const other = await createCourseRow({ organisationId: a.id })
    const foreign = await createStepRow({ versionId: other.versionId })
    await expectRejected(body([videoStep({ id: foreign.id })]), 'steps.0.id', 'Dit onderdeel hoort niet bij deze cursus.')
    await expectRejected(body([videoStep({ id: 999999 })]), 'steps.0.id', 'Dit onderdeel hoort niet bij deze cursus.')
  })

  it('rejects an answer id that does not belong to the step', async () => {
    const other = await createStepRow({ versionId: course.versionId, stepType: 'question' })
    const request = body([
      questionStep({ id: existing.id, answers: [{ id: other.answerIds[0], answerText: 'A', isCorrect: true }, { answerText: 'B', isCorrect: false }] }),
    ])
    await expectRejected(request, 'steps.0.answers.0.id', 'Dit antwoord hoort niet bij dit onderdeel.')
  })

  it('rejects changing the kind of a step', async () => {
    await expectRejected(body([videoStep({ id: existing.id })]), 'steps.0.stepType', 'De soort van een onderdeel kan niet veranderen.')
  })

  it('rejects a video step with a question and a question step with a video', async () => {
    await expectRejected(
      body([videoStep({ questionText: 'Vraag?' })]),
      'steps.0.stepType',
      'Een video-onderdeel heeft geen vraag, antwoorden of feedback.',
    )
    await expectRejected(body([questionStep({ videoId: video.id })]), 'steps.0.stepType', 'Een vraag-onderdeel heeft geen video.')
  })

  it('rejects 1 or 5 answers and not exactly one correct answer', async () => {
    await expectRejected(body([questionStep({ answers: answers('A') })]), 'steps.0.answers', 'Een vraag heeft 2 tot 4 antwoorden.')
    await expectRejected(body([questionStep({ answers: answers('A', 'B', 'C', 'D', 'E') })]), 'steps.0.answers', 'Een vraag heeft 2 tot 4 antwoorden.')
    await expectRejected(
      body([questionStep({ answers: [{ answerText: 'A', isCorrect: true }, { answerText: 'B', isCorrect: true }] })]),
      'steps.0.answers',
      'Kies precies één goed antwoord.',
    )
  })

  it('rejects two start steps', async () => {
    await expectRejected(body([videoStep({ isStart: true }), questionStep({ isStart: true })]), 'steps', 'Er kan maar één startonderdeel zijn.')
  })

  it('rejects an empty name', async () => {
    await expectRejected(body([], { name: ' ' }), 'name', 'Vul een naam en een beschrijving in.')
  })

  it('keeps everything when one step of many is wrong', async () => {
    const steps = [videoStep(), questionStep(), questionStep({ answers: answers('A') })]
    await expectRejected(body(steps), 'steps.2.answers', 'Een vraag heeft 2 tot 4 antwoorden.')
  })
})

describe('request size', () => {
  it('accepts a large draft up to 1 MB', async () => {
    const steps = Array.from({ length: 200 }, (_, i) =>
      questionStep({ positionY: i, questionText: 'é'.repeat(1000), feedback: 'é'.repeat(1000), answers: answers('é'.repeat(255), 'b') }),
    )
    const response = await put(body(steps))
    expect(response.status).toBe(200)
    expect(response.body.steps).toHaveLength(200)
  })

  it('refuses a request over 1 MB', async () => {
    const response = await agent
      .put(url())
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body([], { description: 'x'.repeat(1100 * 1024) })))
    expect(response.status).toBe(413)
    expect(response.body.error.code).toBe('payload_too_large')
  })

  it('keeps the 100 kB limit on other routes', async () => {
    const response = await agent
      .patch(`/api/organisation/videos/${video.id}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ description: 'x'.repeat(200 * 1024) }))
    expect(response.status).toBe(413)
  })
})
