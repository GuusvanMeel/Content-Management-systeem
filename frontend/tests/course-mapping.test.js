import { describe, expect, it } from 'vitest'
import { applyKeyChanges, keyChanges, savedKeys, toEditor, toPayload } from '../src/lib/courseMapping'

// API draft document ↔ editor model (specs/004 research R9, R10; specs/005 research R1).

const doc = {
  id: 12,
  name: 'Redding',
  description: 'Diep bad',
  status: 'draft',
  updatedAt: '2026-10-26T10:15:00.000Z',
  steps: [
    {
      id: 101,
      stepType: 'video',
      isStart: true,
      positionX: 0,
      positionY: 0,
      videoId: 17,
      video: { id: 17, name: 'Zwembad', durationSeconds: 95, thumbnailUrl: '/api/organisation/courses/12/steps/101/videos/17/thumbnail', available: false },
      nextStepId: 103,
    },
    { id: 102, stepType: 'video', isStart: false, positionX: 300, positionY: 0, videoId: null, video: null, nextStepId: null },
    {
      id: 103,
      stepType: 'question',
      isStart: false,
      positionX: 0,
      positionY: 260,
      questionText: 'Wat doe je eerst?',
      feedback: null,
      answers: [
        { id: 501, answerText: 'Alarmeren', isCorrect: true, nextStepId: 102 },
        { id: 502, answerText: '', isCorrect: false, nextStepId: 103 },
      ],
    },
  ],
}

describe('toEditor', () => {
  it('builds the editor model with step and answer keys and connections', () => {
    const { course } = toEditor(doc)
    expect(course).toEqual({
      id: 12,
      name: 'Redding',
      description: 'Diep bad',
      startId: 's101',
      nodes: [
        { id: 's101', type: 'video', x: 0, y: 0, videoId: 17, next: 's103' },
        { id: 's102', type: 'video', x: 300, y: 0, videoId: null, next: null },
        {
          id: 's103',
          type: 'question',
          x: 0,
          y: 260,
          question: 'Wat doe je eerst?',
          feedback: '',
          answers: [
            { id: 'a501', text: 'Alarmeren', correct: true, target: 's102' },
            { id: 'a502', text: '', correct: false, target: 's103' },
          ],
        },
      ],
    })
  })

  it('keeps video details apart, also for a video that is no longer available', () => {
    expect(toEditor(doc).stepVideos).toEqual({
      17: { name: 'Zwembad', durationSeconds: 95, thumbnailUrl: '/api/organisation/courses/12/steps/101/videos/17/thumbnail', available: false },
    })
  })

  it('has no start step when none is marked', () => {
    expect(toEditor({ ...doc, steps: [] }).course.startId).toBeNull()
  })
})

describe('toPayload', () => {
  it('sends every step with its key and connections as keys (specs/005 research R1)', () => {
    const payload = toPayload(toEditor(doc).course, savedKeys(doc))
    expect(payload).toEqual({
      name: 'Redding',
      description: 'Diep bad',
      steps: [
        { key: 's101', id: 101, stepType: 'video', isStart: true, positionX: 0, positionY: 0, videoId: 17, nextStepKey: 's103' },
        { key: 's102', id: 102, stepType: 'video', isStart: false, positionX: 300, positionY: 0, videoId: null, nextStepKey: null },
        {
          key: 's103',
          id: 103,
          stepType: 'question',
          isStart: false,
          positionX: 0,
          positionY: 260,
          questionText: 'Wat doe je eerst?',
          feedback: null,
          answers: [
            { id: 501, answerText: 'Alarmeren', isCorrect: true, nextStepKey: 's102' },
            { id: 502, answerText: '', isCorrect: false, nextStepKey: 's103' },
          ],
        },
      ],
    })
  })

  it('sends temporary keys and unknown saved keys without an id, but still as key', () => {
    const { course } = toEditor(doc)
    course.nodes.push({ id: 'n_abc', type: 'video', x: 1.4, y: 2.6, videoId: null, next: 's102' })
    course.nodes[2].answers.push({ id: 'a_tmp', text: 'Nieuw', correct: false, target: 'n_abc' })
    // s101 was removed and saved, then restored with undo: no longer a saved key.
    const saved = savedKeys(doc)
    saved.delete('s101')
    const payload = toPayload(course, saved)
    expect(payload.steps[0]).not.toHaveProperty('id')
    expect(payload.steps[0].key).toBe('s101')
    expect(payload.steps[3]).toEqual({ key: 'n_abc', stepType: 'video', isStart: false, positionX: 1, positionY: 3, videoId: null, nextStepKey: 's102' })
    expect(payload.steps[2].answers[2]).toEqual({ answerText: 'Nieuw', isCorrect: false, nextStepKey: 'n_abc' })
  })

  it('sends empty feedback as null and filled feedback as text', () => {
    const { course } = toEditor(doc)
    expect(toPayload(course, savedKeys(doc)).steps[2].feedback).toBeNull()
    course.nodes[2].feedback = 'Eerst alarmeren.'
    expect(toPayload(course, savedKeys(doc)).steps[2].feedback).toBe('Eerst alarmeren.')
  })

  it('round-trips: what is sent comes back as the same editor model', () => {
    const { course } = toEditor(doc)
    const payload = toPayload(course, savedKeys(doc))
    const idOfKey = (key) => (key ? Number(key.slice(1)) : null)
    const echoed = {
      ...doc,
      steps: payload.steps.map((s) => {
        const step = { ...s, id: s.id, nextStepId: idOfKey(s.nextStepKey), video: doc.steps.find((d) => d.id === s.id).video }
        delete step.key
        delete step.nextStepKey
        if (s.stepType === 'question') {
          delete step.nextStepId
          delete step.video
          step.answers = s.answers.map(({ nextStepKey, ...a }) => ({ ...a, nextStepId: idOfKey(nextStepKey) }))
        }
        return step
      }),
    }
    expect(toEditor(echoed).course).toEqual(course)
  })
})

describe('keys after saving', () => {
  it('maps new nodes to the new steps in request order, and renames connections too', () => {
    const course = {
      id: 12,
      name: 'R',
      description: 'D',
      startId: 'n_new',
      nodes: [
        {
          id: 'n_new',
          type: 'question',
          x: 0,
          y: 0,
          question: '',
          feedback: '',
          answers: [
            { id: 'a_1', text: '', correct: true, target: 'n_other' },
            { id: 'a_2', text: '', correct: false, target: 's101' },
          ],
        },
        { id: 's101', type: 'video', x: 0, y: 0, videoId: 17, next: 'n_new' },
        { id: 'n_other', type: 'video', x: 0, y: 0, videoId: null, next: null },
      ],
    }
    const result = {
      steps: [
        { id: 101, stepType: 'video' },
        { id: 104, stepType: 'question', answers: [{ id: 601 }, { id: 602 }] },
        { id: 105, stepType: 'video' },
      ],
    }
    const changes = keyChanges(course, result, new Set(['s101']))
    expect(changes).toEqual({ n_new: 's104', a_1: 'a601', a_2: 'a602', s101: 's101', n_other: 's105' })
    applyKeyChanges(course, changes)
    expect(course.startId).toBe('s104')
    expect(course.nodes.map((n) => n.id)).toEqual(['s104', 's101', 's105'])
    expect(course.nodes[0].answers.map((a) => [a.id, a.target])).toEqual([
      ['a601', 's105'],
      ['a602', 's101'],
    ])
    expect(course.nodes[1].next).toBe('s104')
  })
})
