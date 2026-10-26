import { validationError } from './errors.js'
import { characterCount } from './videoChoices.js'

// Rules for the draft document that the editor saves in one go (specs/004 research R4,
// data-model.md § Regels). Pure: checks shape and limits only. Whether ids belong to the course
// and whether a video may be used is checked by courseService against the database.
// Messages are customer-facing.

export const STEP_TYPES = ['video', 'question']
const NAME_MAX = 255
const DESCRIPTION_MAX = 1000
const QUESTION_MAX = 1000
const FEEDBACK_MAX = 1000
const ANSWER_MAX = 255
const STEPS_MAX = 200
const ANSWERS_MIN = 2
const ANSWERS_MAX = 4
const POSITION_LIMIT = 1000000

export const MESSAGES = {
  nameAndDescription: 'Vul een naam en een beschrijving in.',
  nameTooLong: 'De naam mag maximaal 255 tekens lang zijn.',
  descriptionTooLong: 'De beschrijving mag maximaal 1000 tekens zijn.',
  steps: 'De onderdelen konden niet worden gelezen.',
  tooManySteps: 'Een cursus kan maximaal 200 onderdelen hebben.',
  oneStart: 'Er kan maar één startonderdeel zijn.',
  stepType: 'Kies een video- of vraag-onderdeel.',
  position: 'De plaats van dit onderdeel klopt niet.',
  stepId: 'Dit onderdeel hoort niet bij deze cursus.',
  answerId: 'Dit antwoord hoort niet bij dit onderdeel.',
  kindChanged: 'De soort van een onderdeel kan niet veranderen.',
  videoStepContent: 'Een video-onderdeel heeft geen vraag, antwoorden of feedback.',
  questionStepVideo: 'Een vraag-onderdeel heeft geen video.',
  video: 'Kies een video uit de bibliotheek.',
  answerCount: 'Een vraag heeft 2 tot 4 antwoorden.',
  oneCorrect: 'Kies precies één goed antwoord.',
  questionTooLong: 'De vraag mag maximaal 1000 tekens zijn.',
  feedbackTooLong: 'De feedback mag maximaal 1000 tekens zijn.',
  answerTooLong: 'Een antwoord mag maximaal 255 tekens zijn.',
}

const isId = (value) => Number.isInteger(value) && value > 0 && value <= 4294967295
const isEmpty = (value) => value === undefined || value === null || value === ''
const text = (raw) => (typeof raw === 'string' ? raw.replace(/\r\n?/g, '\n') : '')

/** Name and description of a course: trimmed and required (FR-001, FR-005, FR-026). */
export function checkCourseFields(body, fields) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const description = typeof body?.description === 'string' ? text(body.description).trim() : ''
  if (!name) fields.name = MESSAGES.nameAndDescription
  else if (characterCount(name) > NAME_MAX) fields.name = MESSAGES.nameTooLong
  if (!description) fields.description = MESSAGES.nameAndDescription
  else if (characterCount(description) > DESCRIPTION_MAX) fields.description = MESSAGES.descriptionTooLong
  return { name, description }
}

/** Throws one validation error for name and description, or returns them trimmed. */
export function validateCourseFields(body) {
  const fields = {}
  const result = checkCourseFields(body, fields)
  if (Object.keys(fields).length > 0) throw validationError(fields)
  return result
}

function checkAnswers(raw, prefix, fields) {
  if (!Array.isArray(raw) || raw.length < ANSWERS_MIN || raw.length > ANSWERS_MAX) {
    fields[`${prefix}.answers`] = MESSAGES.answerCount
    return []
  }
  const seen = new Set()
  const answers = raw.map((answer, j) => {
    const key = `${prefix}.answers.${j}`
    let id
    if (!isEmpty(answer?.id)) {
      if (!isId(answer.id) || seen.has(answer.id)) fields[`${key}.id`] = MESSAGES.answerId
      else {
        id = answer.id
        seen.add(id)
      }
    }
    // Only trailing line breaks are not meaningful; an unfilled answer is ''.
    const answerText = text(answer?.answerText).trim()
    if (characterCount(answerText) > ANSWER_MAX) fields[`${key}.answerText`] = MESSAGES.answerTooLong
    return { id, answerText, isCorrect: answer?.isCorrect === true }
  })
  if (answers.filter((answer) => answer.isCorrect).length !== 1) fields[`${prefix}.answers`] = MESSAGES.oneCorrect
  return answers
}

function checkStep(raw, i, seenIds, fields) {
  const prefix = `steps.${i}`
  const step = {
    stepType: raw?.stepType,
    isStart: raw?.isStart === true,
    positionX: raw?.positionX,
    positionY: raw?.positionY,
  }
  if (!isEmpty(raw?.id)) {
    if (!isId(raw.id) || seenIds.has(raw.id)) fields[`${prefix}.id`] = MESSAGES.stepId
    else {
      step.id = raw.id
      seenIds.add(raw.id)
    }
  }
  const validPosition = (value) => Number.isInteger(value) && Math.abs(value) <= POSITION_LIMIT
  if (!validPosition(step.positionX) || !validPosition(step.positionY)) fields[`${prefix}.position`] = MESSAGES.position

  if (step.stepType === 'video') {
    // FR-012: a video step never carries question content; null or '' counts as absent.
    if (!isEmpty(raw.questionText) || !isEmpty(raw.feedback) || (raw.answers !== undefined && raw.answers !== null)) {
      fields[`${prefix}.stepType`] = MESSAGES.videoStepContent
    }
    if (isEmpty(raw.videoId)) step.videoId = null
    else if (isId(raw.videoId)) step.videoId = raw.videoId
    else fields[`${prefix}.videoId`] = MESSAGES.video
    return step
  }

  if (step.stepType === 'question') {
    if (!isEmpty(raw.videoId)) fields[`${prefix}.stepType`] = MESSAGES.questionStepVideo
    // FR-013: an empty question is allowed in a draft and stored as ''.
    step.questionText = text(raw.questionText).trim()
    if (characterCount(step.questionText) > QUESTION_MAX) fields[`${prefix}.questionText`] = MESSAGES.questionTooLong
    const feedback = text(raw.feedback).trim()
    step.feedback = feedback || null
    if (characterCount(feedback) > FEEDBACK_MAX) fields[`${prefix}.feedback`] = MESSAGES.feedbackTooLong
    step.answers = checkAnswers(raw.answers, prefix, fields)
    return step
  }

  fields[`${prefix}.stepType`] = MESSAGES.stepType
  return step
}

/**
 * Checks and normalises a whole draft: { name, description, steps }. Collects every error and
 * throws one validation error, so the editor can mark all wrong fields at once. Never reads
 * `description` or `nextCourseStepId` of a step (FR-017, FR-019).
 */
export function validateDraft(body) {
  const fields = {}
  const { name, description } = checkCourseFields(body, fields)
  const raw = body?.steps
  let steps = []
  if (!Array.isArray(raw)) fields.steps = MESSAGES.steps
  else if (raw.length > STEPS_MAX) fields.steps = MESSAGES.tooManySteps
  else {
    const seenIds = new Set()
    steps = raw.map((step, i) => checkStep(step, i, seenIds, fields))
    if (steps.filter((step) => step.isStart).length > 1) fields.steps = MESSAGES.oneStart
  }
  if (Object.keys(fields).length > 0) throw validationError(fields)
  return { name, description, steps }
}
