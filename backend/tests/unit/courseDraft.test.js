import { describe, expect, it } from 'vitest'
import { validateDraft } from '../../src/lib/courseDraft.js'

// The draft document rules (specs/004 research R4, data-model.md § Regels).

const videoStep = (extra = {}) => ({ stepType: 'video', isStart: false, positionX: 0, positionY: 0, videoId: null, ...extra })
const questionStep = (extra = {}) => ({
  stepType: 'question',
  isStart: false,
  positionX: 0,
  positionY: 0,
  questionText: 'Wat doe je eerst?',
  feedback: null,
  answers: [
    { answerText: 'Alarmeren', isCorrect: true },
    { answerText: 'Springen', isCorrect: false },
  ],
  ...extra,
})
const draft = (extra = {}) => ({ name: 'Cursus', description: 'Beschrijving', steps: [], ...extra })

/** The `fields` of the validation error thrown for `body`. */
function fieldsOf(body) {
  try {
    validateDraft(body)
  } catch (err) {
    expect(err.code).toBe('validation_failed')
    return err.fields
  }
  throw new Error('expected a validation error')
}

describe('name and description (FR-001, FR-005, FR-026)', () => {
  it('trims both', () => {
    expect(validateDraft(draft({ name: '  Cursus  ', description: '\n Tekst \n' }))).toMatchObject({ name: 'Cursus', description: 'Tekst' })
  })

  it('requires both, also when they are only spaces', () => {
    expect(fieldsOf(draft({ name: '   ', description: '' }))).toEqual({
      name: 'Vul een naam en een beschrijving in.',
      description: 'Vul een naam en een beschrijving in.',
    })
    expect(fieldsOf(draft({ name: undefined }))).toHaveProperty('name')
  })

  it('allows 255 and 1000 characters, not 256 and 1001', () => {
    expect(() => validateDraft(draft({ name: 'a'.repeat(255), description: 'b'.repeat(1000) }))).not.toThrow()
    expect(fieldsOf(draft({ name: 'a'.repeat(256) })).name).toBe('De naam mag maximaal 255 tekens lang zijn.')
    expect(fieldsOf(draft({ description: 'b'.repeat(1001) })).description).toBe('De beschrijving mag maximaal 1000 tekens zijn.')
  })

  it('counts an emoji as one character', () => {
    expect(() => validateDraft(draft({ name: '🏊'.repeat(255) }))).not.toThrow()
    expect(fieldsOf(draft({ name: '🏊'.repeat(256) }))).toHaveProperty('name')
  })
})

describe('steps', () => {
  it('requires a list', () => {
    expect(fieldsOf(draft({ steps: 'geen lijst' })).steps).toBeDefined()
  })

  it('allows at most 200 steps', () => {
    expect(() => validateDraft(draft({ steps: Array.from({ length: 200 }, () => videoStep()) }))).not.toThrow()
    expect(fieldsOf(draft({ steps: Array.from({ length: 201 }, () => videoStep()) })).steps).toBe(
      'Een cursus kan maximaal 200 onderdelen hebben.',
    )
  })

  it('only knows video and question', () => {
    expect(fieldsOf(draft({ steps: [videoStep({ stepType: 'tekst' })] }))).toHaveProperty(['steps.0.stepType'])
  })

  it('allows at most one start step (FR-018)', () => {
    expect(() => validateDraft(draft({ steps: [videoStep({ isStart: true }), videoStep()] }))).not.toThrow()
    expect(fieldsOf(draft({ steps: [videoStep({ isStart: true }), questionStep({ isStart: true })] })).steps).toBe(
      'Er kan maar één startonderdeel zijn.',
    )
  })

  it('needs whole-number positions within ±1 000 000 (FR-021)', () => {
    expect(() => validateDraft(draft({ steps: [videoStep({ positionX: -1000000, positionY: 1000000 })] }))).not.toThrow()
    expect(fieldsOf(draft({ steps: [videoStep({ positionX: 1000001 })] }))).toHaveProperty(['steps.0.position'])
    expect(fieldsOf(draft({ steps: [videoStep({ positionY: 1.5 })] }))).toHaveProperty(['steps.0.position'])
    expect(fieldsOf(draft({ steps: [videoStep({ positionY: '10' })] }))).toHaveProperty(['steps.0.position'])
  })

  it('accepts a positive whole-number id or none, and no id twice', () => {
    expect(validateDraft(draft({ steps: [videoStep({ id: 7 })] })).steps[0].id).toBe(7)
    expect(validateDraft(draft({ steps: [videoStep()] })).steps[0].id).toBeUndefined()
    expect(fieldsOf(draft({ steps: [videoStep({ id: 'n1' })] }))).toHaveProperty(['steps.0.id'])
    expect(fieldsOf(draft({ steps: [videoStep({ id: 7 }), videoStep({ id: 7 })] }))).toHaveProperty(['steps.1.id'])
  })

  it('never reads description or nextCourseStepId', () => {
    const [step] = validateDraft(draft({ steps: [videoStep({ description: 'x', nextCourseStepId: 3 })] })).steps
    expect(step).not.toHaveProperty('description')
    expect(step).not.toHaveProperty('nextCourseStepId')
  })
})

describe('video steps (FR-012)', () => {
  it('may have no video yet in a draft', () => {
    expect(validateDraft(draft({ steps: [videoStep()] })).steps[0]).toMatchObject({ stepType: 'video', videoId: null })
  })

  it('keeps a positive whole-number video id', () => {
    expect(validateDraft(draft({ steps: [videoStep({ videoId: 17 })] })).steps[0].videoId).toBe(17)
    expect(fieldsOf(draft({ steps: [videoStep({ videoId: -1 })] }))['steps.0.videoId']).toBe('Kies een video uit de bibliotheek.')
  })

  it('has no question, answers or feedback', () => {
    const message = 'Een video-onderdeel heeft geen vraag, antwoorden of feedback.'
    expect(fieldsOf(draft({ steps: [videoStep({ questionText: 'Vraag?' })] }))['steps.0.stepType']).toBe(message)
    expect(fieldsOf(draft({ steps: [videoStep({ answers: [] })] }))['steps.0.stepType']).toBe(message)
    expect(fieldsOf(draft({ steps: [videoStep({ feedback: 'Goed zo' })] }))['steps.0.stepType']).toBe(message)
  })

  it('treats null and empty values as absent', () => {
    expect(() => validateDraft(draft({ steps: [videoStep({ questionText: null, feedback: '', answers: null })] }))).not.toThrow()
  })
})

describe('question steps (FR-013, FR-017)', () => {
  it('has no video', () => {
    expect(fieldsOf(draft({ steps: [questionStep({ videoId: 3 })] }))['steps.0.stepType']).toBe('Een vraag-onderdeel heeft geen video.')
  })

  it('has 2 to 4 answers', () => {
    const answers = (n) => Array.from({ length: n }, (_, i) => ({ answerText: `A${i}`, isCorrect: i === 0 }))
    expect(() => validateDraft(draft({ steps: [questionStep({ answers: answers(2) })] }))).not.toThrow()
    expect(() => validateDraft(draft({ steps: [questionStep({ answers: answers(4) })] }))).not.toThrow()
    expect(fieldsOf(draft({ steps: [questionStep({ answers: answers(1) })] }))['steps.0.answers']).toBe('Een vraag heeft 2 tot 4 antwoorden.')
    expect(fieldsOf(draft({ steps: [questionStep({ answers: answers(5) })] }))['steps.0.answers']).toBe('Een vraag heeft 2 tot 4 antwoorden.')
    expect(fieldsOf(draft({ steps: [questionStep({ answers: undefined })] }))['steps.0.answers']).toBe('Een vraag heeft 2 tot 4 antwoorden.')
  })

  it('has exactly one correct answer', () => {
    const none = [{ answerText: 'A', isCorrect: false }, { answerText: 'B', isCorrect: false }]
    const two = [{ answerText: 'A', isCorrect: true }, { answerText: 'B', isCorrect: true }]
    expect(fieldsOf(draft({ steps: [questionStep({ answers: none })] }))['steps.0.answers']).toBe('Kies precies één goed antwoord.')
    expect(fieldsOf(draft({ steps: [questionStep({ answers: two })] }))['steps.0.answers']).toBe('Kies precies één goed antwoord.')
  })

  it('allows an empty question and empty answers in a draft', () => {
    const [step] = validateDraft(
      draft({ steps: [questionStep({ questionText: '', answers: [{ answerText: '', isCorrect: true }, { answerText: '', isCorrect: false }] })] }),
    ).steps
    expect(step.questionText).toBe('')
    expect(step.answers.map((a) => a.answerText)).toEqual(['', ''])
  })

  it('stores a missing question as empty text and empty feedback as null', () => {
    const [step] = validateDraft(draft({ steps: [questionStep({ questionText: null, feedback: '   ' })] })).steps
    expect(step.questionText).toBe('')
    expect(step.feedback).toBeNull()
  })

  it('normalises line breaks', () => {
    const [step] = validateDraft(draft({ steps: [questionStep({ questionText: 'Regel 1\r\nRegel 2', feedback: 'a\rb' })] })).steps
    expect(step.questionText).toBe('Regel 1\nRegel 2')
    expect(step.feedback).toBe('a\nb')
  })

  it('limits question and feedback to 1000 and answers to 255 characters', () => {
    expect(() =>
      validateDraft(
        draft({
          steps: [
            questionStep({
              questionText: 'q'.repeat(1000),
              feedback: 'f'.repeat(1000),
              answers: [{ answerText: 'a'.repeat(255), isCorrect: true }, { answerText: '', isCorrect: false }],
            }),
          ],
        }),
      ),
    ).not.toThrow()
    expect(fieldsOf(draft({ steps: [questionStep({ questionText: 'q'.repeat(1001) })] }))['steps.0.questionText']).toBe(
      'De vraag mag maximaal 1000 tekens zijn.',
    )
    expect(fieldsOf(draft({ steps: [questionStep({ feedback: 'f'.repeat(1001) })] }))['steps.0.feedback']).toBe(
      'De feedback mag maximaal 1000 tekens zijn.',
    )
    const long = [{ answerText: 'x', isCorrect: true }, { answerText: 'a'.repeat(256), isCorrect: false }]
    expect(fieldsOf(draft({ steps: [questionStep({ answers: long })] }))['steps.0.answers.1.answerText']).toBe(
      'Een antwoord mag maximaal 255 tekens zijn.',
    )
  })

  it('reports errors with the step and answer position, all at once', () => {
    const fields = fieldsOf(
      draft({
        name: '',
        steps: [
          videoStep(),
          videoStep(),
          videoStep(),
          questionStep({ answers: [{ answerText: 'x', isCorrect: true }, { answerText: 'a'.repeat(256), isCorrect: false }] }),
        ],
      }),
    )
    expect(Object.keys(fields).sort()).toEqual(['name', 'steps.3.answers.1.answerText'])
  })

  it('keeps answer ids and rejects ids that are not positive whole numbers', () => {
    const answers = [{ id: 4, answerText: 'A', isCorrect: true }, { answerText: 'B', isCorrect: false }]
    expect(validateDraft(draft({ steps: [questionStep({ answers })] })).steps[0].answers.map((a) => a.id)).toEqual([4, undefined])
    const bad = [{ id: 'a1', answerText: 'A', isCorrect: true }, { answerText: 'B', isCorrect: false }]
    expect(fieldsOf(draft({ steps: [questionStep({ answers: bad })] }))).toHaveProperty(['steps.0.answers.0.id'])
  })
})
