import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createCourseRow, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'

// Connections between steps (specs/005 FR-001 – FR-008, SC-002, SC-006, research R1, R2).

let a
let agent
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
  course = await createCourseRow({ organisationId: a.id })
})

const url = () => `/api/organisation/courses/${course.courseId}`
const put = (steps) => agent.put(url()).send({ name: 'Route', description: 'Met vertakkingen', steps })
const video = (key, nextStepKey = null, extra = {}) => ({
  key,
  stepType: 'video',
  isStart: false,
  positionX: 0,
  positionY: 0,
  videoId: null,
  nextStepKey,
  ...extra,
})
const question = (key, targets, extra = {}) => ({
  key,
  stepType: 'question',
  isStart: false,
  positionX: 0,
  positionY: 0,
  questionText: 'Wat doe je?',
  feedback: null,
  answers: targets.map((nextStepKey, i) => ({ answerText: `Antwoord ${i + 1}`, isCorrect: i === 0, nextStepKey })),
  ...extra,
})
const dbState = async () => ({
  steps: await db('CourseStep').where({ courseVersionId: course.versionId }).orderBy('id'),
  answers: await db('Answer').orderBy('id'),
})

const LETTERS = ['A', 'B', 'C', 'D']

/** The route of a saved draft as text, e.g. "Q:A>V1,B>V2 | V1:- | V2:-", using the given labels. */
function route(doc, labels) {
  const label = (id) => labels[doc.steps.findIndex((s) => s.id === id)] ?? '?'
  return doc.steps
    .map((s, i) => {
      if (s.stepType === 'video') return `${labels[i]}:${s.nextStepId ? label(s.nextStepId) : '-'}`
      const branches = s.answers.map((x, j) => `${LETTERS[j]}>${x.nextStepId ? label(x.nextStepId) : '-'}`)
      return `${labels[i]}:${branches.join(',')}`
    })
    .join(' | ')
}

describe('saving connections (FR-007)', () => {
  it('connects to steps that are new in the same save', async () => {
    const response = await put([question('q', ['v1', 'v2'], { isStart: true }), video('v1'), video('v2')])
    expect(response.status).toBe(200)
    expect(route(response.body, ['Q', 'V1', 'V2'])).toBe('Q:A>V1,B>V2 | V1:- | V2:-')
    expect(response.body.steps[0]).not.toHaveProperty('nextStepId')
  })

  it('allows a loop back, an answer to its own question and two answers to one step', async () => {
    const response = await put([video('v1', 'q', { isStart: true }), question('q', ['v2', 'v1', 'q']), video('v2', 'v1')])
    expect(response.status).toBe(200)
    const doc = (await agent.get(url())).body
    expect(route(doc, ['V1', 'Q', 'V2'])).toBe('V1:Q | Q:A>V2,B>V1,C>Q | V2:V1')
  })

  it('lets two answers go to the same step', async () => {
    const doc = (await put([question('q', ['v', 'v'], { isStart: true }), video('v')])).body
    expect(route(doc, ['Q', 'V'])).toBe('Q:A>V,B>V | V:-')
  })

  it('keeps ids and connections over three saves in a row', async () => {
    const first = (await put([video('v1', 'v2', { isStart: true }), video('v2')])).body
    const asSaved = (doc) =>
      doc.steps.map((s) => ({ ...video(`s${s.id}`, s.nextStepId ? `s${s.nextStepId}` : null, { isStart: s.isStart }), id: s.id }))
    const second = (await put(asSaved(first))).body
    const third = (await put(asSaved(second))).body
    expect(third.steps.map((s) => s.id)).toEqual(first.steps.map((s) => s.id))
    expect(third.steps.map((s) => s.nextStepId)).toEqual(first.steps.map((s) => s.nextStepId))
    expect(first.steps[0].nextStepId).toBe(first.steps[1].id)
  })

  it('makes no duplicates when the same request is sent again', async () => {
    const request = [question('q', ['v1', 'v2'], { isStart: true }), video('v1'), video('v2')]
    await put(request)
    const again = (await put(request)).body
    expect(again.steps).toHaveLength(3)
    expect(route(again, ['Q', 'V1', 'V2'])).toBe('Q:A>V1,B>V2 | V1:- | V2:-')
    expect((await dbState()).steps).toHaveLength(3)
  })

  it('clears a connection to a step that is left out (FR-006)', async () => {
    const saved = (await put([video('v1', 'v2', { isStart: true }), video('v2')])).body
    const response = await put([{ ...video(`s${saved.steps[0].id}`), id: saved.steps[0].id, isStart: true }])
    expect(response.status).toBe(200)
    expect(response.body.steps).toEqual([expect.objectContaining({ id: saved.steps[0].id, nextStepId: null })])
  })

  it('never stores a next step on a question itself', async () => {
    await put([question('q', ['v', null], { isStart: true }), video('v')])
    const [questionRow] = (await dbState()).steps
    expect(questionRow.stepType).toBe('question')
    expect(questionRow.nextCourseStepId).toBeNull()
  })
})

describe('invalid connections change nothing (FR-008, SC-006)', () => {
  const expectRejected = async (steps, field, message) => {
    await put([video('v0', null, { isStart: true })])
    const before = await dbState()
    const response = await put(steps)
    expect(response.status).toBe(400)
    expect(response.body.error.fields[field]).toBe(message)
    expect(await dbState()).toEqual(before)
  }

  it('refuses an unknown next-step key', async () => {
    await expectRejected([video('v1', 'nergens')], 'steps.0.nextStepKey', 'Dit vervolg bestaat niet in deze cursus.')
  })

  it('refuses a key that points to a step of another course', async () => {
    const other = await createCourseRow({ organisationId: a.id })
    const otherSaved = (
      await agent.put(`/api/organisation/courses/${other.courseId}`).send({ name: 'X', description: 'Y', steps: [video('w')] })
    ).body
    await expectRejected([video('v1', `s${otherSaved.steps[0].id}`)], 'steps.0.nextStepKey', 'Dit vervolg bestaat niet in deze cursus.')
  })

  it('refuses a video step that points to itself', async () => {
    await expectRejected([video('v1', 'v1')], 'steps.0.nextStepKey', 'Een video-onderdeel kan niet naar zichzelf wijzen.')
  })

  it('refuses a next step on a question', async () => {
    await expectRejected(
      [video('v1'), question('q', [null, null], { nextStepKey: 'v1' })],
      'steps.1.nextStepKey',
      'Een vraag gaat verder via haar antwoorden.',
    )
  })

  it('refuses duplicate and missing keys', async () => {
    await expectRejected([video('v1'), video('v1')], 'steps.1.key', 'Dit onderdeel heeft geen geldige sleutel.')
    await expectRejected([{ ...video('x'), key: undefined }], 'steps.0.key', 'Dit onderdeel heeft geen geldige sleutel.')
  })
})
