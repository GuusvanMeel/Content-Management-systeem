import { db } from '../../db/knex.js'
import { notFound, validationError } from '../../lib/errors.js'
import { MESSAGES, validateCourseFields, validateDraft } from '../../lib/courseDraft.js'
import * as repo from './courseRepository.js'

// Courses and their draft (specs/004 contracts/api.md). Saving replaces the whole draft in one
// transaction (research R3): steps and answers with an id are updated, without an id inserted,
// and the ones missing from the request are deleted. The last save wins.

/**
 * The video of a video step: always name, duration and thumbnail, also when the video is no
 * longer in the library; `available` says whether it is (research R5a). Nothing else of the video.
 */
function toStepVideo(courseId, stepId, row, library) {
  return {
    id: row.id,
    name: row.name,
    durationSeconds: row.durationSeconds,
    thumbnailUrl: row.thumbnailStorageKey
      ? `/api/organisation/courses/${courseId}/steps/${stepId}/videos/${row.id}/thumbnail`
      : null,
    available: library.has(row.id),
  }
}

/** The draft document of contracts/api.md. */
async function toDraftDocument(course, organisationId, trx) {
  const steps = await repo.listSteps(course.versionId, trx)
  const answers = await repo.listAnswers(steps.map((step) => step.id), trx)
  const videos = await repo.stepVideos(course.versionId, trx)
  const library = await repo.libraryVideoIds(organisationId, [...new Set([...videos.values()].map((row) => row.id))], trx)
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    status: 'draft',
    updatedAt: new Date(course.updatedAt).toISOString(),
    steps: steps.map((step) => {
      const base = {
        id: step.id,
        stepType: step.stepType,
        isStart: Boolean(step.isStart),
        positionX: step.positionX,
        positionY: step.positionY,
      }
      if (step.stepType === 'video') {
        const row = videos.get(step.id)
        return {
          ...base,
          videoId: step.videoId,
          video: row ? toStepVideo(course.id, step.id, row, library) : null,
          nextStepId: step.nextCourseStepId ?? null,
        }
      }
      return {
        ...base,
        questionText: step.questionText ?? '',
        feedback: step.feedback,
        answers: answers
          .filter((answer) => answer.courseStepId === step.id)
          .map((answer) => ({
            id: answer.id,
            answerText: answer.answerText,
            isCorrect: Boolean(answer.isCorrect),
            nextStepId: answer.nextCourseStepId ?? null,
          })),
      }
    }),
  }
}

/** The course list of contracts/api.md; every course is a draft in this feature. */
export async function listCourses(organisationId) {
  const rows = await repo.listOwnCourses(organisationId)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    updatedAt: new Date(row.updatedAt).toISOString(),
    videoStepCount: Number(row.videoStepCount),
    questionStepCount: Number(row.questionStepCount),
    status: 'draft',
  }))
}

/** A new, empty draft for the organisation in the session (FR-001, FR-002). */
export async function createCourse(organisationId, body) {
  const fields = validateCourseFields(body)
  return db.transaction(async (trx) => {
    const id = await repo.insertCourse(trx, organisationId, fields)
    return getDraft(id, organisationId, trx)
  })
}

export async function getDraft(courseId, organisationId, trx = db) {
  const course = await repo.findOwnCourse(courseId, organisationId, trx)
  if (!course) throw notFound()
  return toDraftDocument(course, organisationId, trx)
}

/**
 * A video may be put in a step when it is in the organisation's library. The one exception is the
 * video a saved step already has: it stays, also when it is no longer available (FR-014, FR-016,
 * research R5). So an unavailable video can never reach a new or another step.
 */
async function checkVideos(steps, storedSteps, organisationId, trx) {
  const storedVideo = new Map(storedSteps.map((step) => [step.id, step.videoId]))
  const wanted = steps.filter((step) => step.stepType === 'video' && step.videoId !== null)
  const library = await repo.libraryVideoIds(organisationId, [...new Set(wanted.map((step) => step.videoId))], trx)
  const fields = {}
  steps.forEach((step, i) => {
    if (step.stepType !== 'video' || step.videoId === null || library.has(step.videoId)) return
    if (step.id !== undefined && storedVideo.get(step.id) === step.videoId) return
    fields[`steps.${i}.videoId`] = MESSAGES.video
  })
  if (Object.keys(fields).length > 0) throw validationError(fields)
}

/**
 * The thumbnail of the video in a step of an own course (FR-016a), only while the step still has
 * that video; 404 for anything else.
 */
export async function getStepVideoThumbnailKey(courseId, stepId, videoId, organisationId) {
  const key = await repo.findStepVideoThumbnailKey(courseId, stepId, videoId, organisationId)
  if (!key) throw notFound()
  return key
}

/** Soft deletes an own course (FR-006); 404 when it is not visible to the organisation. */
export async function deleteCourse(courseId, organisationId) {
  if ((await repo.softDeleteOwnCourse(courseId, organisationId)) === 0) throw notFound()
}

/**
 * Checks that every id in the request belongs to this draft and that no step changes its kind.
 * Returns the stored steps and answers by id, for the update below.
 */
function checkIds(steps, storedSteps, storedAnswers) {
  const fields = {}
  const stepById = new Map(storedSteps.map((step) => [step.id, step]))
  steps.forEach((step, i) => {
    if (step.id === undefined) return
    const stored = stepById.get(step.id)
    if (!stored) {
      fields[`steps.${i}.id`] = MESSAGES.stepId
      return
    }
    if (stored.stepType !== step.stepType) {
      fields[`steps.${i}.stepType`] = MESSAGES.kindChanged
      return
    }
    for (const [j, answer] of (step.answers ?? []).entries()) {
      if (answer.id === undefined) continue
      const owner = storedAnswers.find((row) => row.id === answer.id)?.courseStepId
      if (owner !== step.id) fields[`steps.${i}.answers.${j}.id`] = MESSAGES.answerId
    }
  })
  if (Object.keys(fields).length > 0) throw validationError(fields)
}

// Connections are written afterwards, once every step has an id (specs/005 research R1).
const stepRow = (step) =>
  step.stepType === 'video'
    ? { stepType: 'video', isStart: step.isStart, positionX: step.positionX, positionY: step.positionY, videoId: step.videoId, questionText: null, feedback: null, nextCourseStepId: null }
    : { stepType: 'question', isStart: step.isStart, positionX: step.positionX, positionY: step.positionY, videoId: null, questionText: step.questionText, feedback: step.feedback, nextCourseStepId: null }

/** Saves the answers of a question step; returns their ids in request order. */
async function saveAnswers(trx, stepId, answers, storedAnswers) {
  const keep = new Set(answers.filter((answer) => answer.id !== undefined).map((answer) => answer.id))
  await repo.deleteAnswers(
    trx,
    storedAnswers.filter((row) => row.courseStepId === stepId && !keep.has(row.id)).map((row) => row.id),
  )
  const ids = []
  for (const [sortOrder, answer] of answers.entries()) {
    const row = { answerText: answer.answerText, isCorrect: answer.isCorrect, sortOrder, nextCourseStepId: null }
    if (answer.id === undefined) ids.push(await repo.insertAnswer(trx, stepId, row))
    else {
      await repo.updateAnswer(trx, answer.id, row)
      ids.push(answer.id)
    }
  }
  return ids
}

/** Points steps and answers to their next step, now that every key has an id (research R1). */
async function saveConnections(trx, steps, stepIds, answerIds) {
  const idByKey = new Map(steps.map((step, i) => [step.key, stepIds[i]]))
  for (const [i, step] of steps.entries()) {
    if (step.stepType === 'video' && step.nextStepKey !== null) {
      await repo.setStepNext(trx, stepIds[i], idByKey.get(step.nextStepKey))
    }
    for (const [j, answer] of (step.answers ?? []).entries()) {
      if (answer.nextStepKey !== null) await repo.setAnswerNext(trx, answerIds[i][j], idByKey.get(answer.nextStepKey))
    }
  }
}

/** "Opslaan als concept": all or nothing (FR-009). Returns the saved draft document. */
export async function saveDraft(courseId, organisationId, body) {
  const draft = validateDraft(body)
  return db.transaction(async (trx) => {
    // Locking the draft row makes two saves of the same course run one after the other.
    const course = await repo.findOwnCourse(courseId, organisationId, trx, { forUpdate: true })
    if (!course) throw notFound()
    const storedSteps = await repo.listSteps(course.versionId, trx)
    const storedAnswers = await repo.listAnswers(storedSteps.map((step) => step.id), trx)
    checkIds(draft.steps, storedSteps, storedAnswers)
    await checkVideos(draft.steps, storedSteps, organisationId, trx)

    const keep = new Set(draft.steps.filter((step) => step.id !== undefined).map((step) => step.id))
    await repo.deleteSteps(trx, storedSteps.filter((step) => !keep.has(step.id)).map((step) => step.id))
    const stepIds = []
    const answerIds = []
    for (const step of draft.steps) {
      let stepId = step.id
      if (stepId === undefined) stepId = await repo.insertStep(trx, course.versionId, stepRow(step))
      else await repo.updateStep(trx, stepId, stepRow(step))
      stepIds.push(stepId)
      answerIds.push(step.stepType === 'question' ? await saveAnswers(trx, stepId, step.answers, storedAnswers) : [])
    }
    await saveConnections(trx, draft.steps, stepIds, answerIds)

    await repo.updateDraftFields(trx, course.versionId, draft)
    await repo.touchCourse(trx, course.id)
    return getDraft(course.id, organisationId, trx)
  })
}
