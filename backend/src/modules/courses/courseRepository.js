import { db } from '../../db/knex.js'
import { visibleVideosQuery } from '../videos/videoRepository.js'

// Queries from specs/004 data-model.md. Every function takes the organisation id explicitly; it
// always comes from the session. Soft-deleted courses are excluded (constitution V).

function requireId(organisationId) {
  if (!organisationId) throw new Error('organisationId is required')
}

/**
 * The only definition of "courses this organisation may see and edit" (specs/004 research R2):
 * owned through OrganisationCourse, not deleted, joined with the draft (the version without
 * publishedAt). Every course route starts from this query.
 */
export function ownCoursesQuery(organisationId, trx = db) {
  requireId(organisationId)
  return trx('Course as c')
    .join('OrganisationCourse as oc', function joinOwner() {
      this.on('oc.courseId', '=', 'c.id').andOnVal('oc.organisationId', '=', organisationId).andOnVal('oc.isOwner', '=', true)
    })
    .join('CourseVersion as cv', function joinDraft() {
      this.on('cv.courseId', '=', 'c.id').andOnNull('cv.publishedAt')
    })
    .whereNull('c.deletedAt')
}

/** The course with its draft, or undefined. `forUpdate` locks the draft row inside a transaction. */
export function findOwnCourse(id, organisationId, trx = db, { forUpdate = false } = {}) {
  const query = ownCoursesQuery(organisationId, trx)
    .where('c.id', id)
    .select('c.id', 'c.updatedAt', 'cv.id as versionId', 'cv.name', 'cv.description')
    .first()
  return forUpdate ? query.forUpdate() : query
}

/** Own courses for the list: newest change first, with the number of steps of each kind (research R6). */
export function listOwnCourses(organisationId) {
  return ownCoursesQuery(organisationId)
    .leftJoin('CourseStep as s', 's.courseVersionId', 'cv.id')
    .groupBy('c.id', 'c.updatedAt', 'cv.name')
    .orderBy([
      { column: 'c.updatedAt', order: 'desc' },
      { column: 'c.id', order: 'desc' },
    ])
    .select(
      'c.id',
      'c.updatedAt',
      'cv.name',
      db.raw("COUNT(CASE WHEN s.stepType = 'video' THEN 1 END) AS videoStepCount"),
      db.raw("COUNT(CASE WHEN s.stepType = 'question' THEN 1 END) AS questionStepCount"),
    )
}

/**
 * A new course: Course, its owner row and the draft (version 1), all at the database clock
 * (research R1). The draft starts with one video step without a video, marked as the start step
 * (specs/004 FR-001a).
 */
export async function insertCourse(trx, organisationId, { name, description }) {
  requireId(organisationId)
  const now = db.raw('UTC_TIMESTAMP()')
  const [courseId] = await trx('Course').insert({ isSharedInLibrary: false, createdAt: now, updatedAt: now })
  await trx('OrganisationCourse').insert({ organisationId, courseId, isOwner: true, addedAt: now })
  const [versionId] = await trx('CourseVersion').insert({ courseId, versionNumber: 1, name, description, publishedAt: null })
  await trx('CourseStep').insert({ courseVersionId: versionId, stepType: 'video', isStart: true, videoId: null, positionX: 0, positionY: 0 })
  return courseId
}

export function listSteps(versionId, trx = db) {
  return trx('CourseStep')
    .where({ courseVersionId: versionId })
    .orderBy('id')
    .select('id', 'stepType', 'isStart', 'videoId', 'questionText', 'feedback', 'positionX', 'positionY')
}

export function listAnswers(stepIds, trx = db) {
  if (stepIds.length === 0) return []
  return trx('Answer')
    .whereIn('courseStepId', stepIds)
    .orderBy(['courseStepId', 'sortOrder'])
    .select('id', 'courseStepId', 'answerText', 'isCorrect', 'sortOrder')
}

/** Of `videoIds`, the ones in the organisation's library (the unchanged rule of specs/003 R1). */
export async function libraryVideoIds(organisationId, videoIds, trx = db) {
  if (videoIds.length === 0) return new Set()
  const rows = await visibleVideosQuery(organisationId, trx).clearSelect().whereIn('v.id', videoIds).select('v.id')
  return new Set(rows.map((row) => row.id))
}

/**
 * The videos of the video steps of a draft, by step id. No filter on Video.deletedAt or on
 * visibility: a video used in an own course keeps showing there (specs/004 FR-016, research R5a).
 * Only the fields the course may show are read.
 */
export async function stepVideos(versionId, trx = db) {
  const rows = await trx('CourseStep as s')
    .join('Video as v', 'v.id', 's.videoId')
    .where('s.courseVersionId', versionId)
    .select('s.id as stepId', 'v.id', 'v.name', 'v.durationSeconds', 'v.thumbnailStorageKey')
  return new Map(rows.map((row) => [row.stepId, row]))
}

/**
 * The thumbnail of the video in a video step of an own course's draft, or undefined. This is the
 * only place where a video outside the organisation's library is shown; the library rule itself
 * is not widened (specs/004 FR-016a, research R5a).
 */
export async function findStepVideoThumbnailKey(courseId, stepId, videoId, organisationId) {
  const row = await ownCoursesQuery(organisationId)
    .join('CourseStep as s', 's.courseVersionId', 'cv.id')
    .join('Video as v', 'v.id', 's.videoId')
    .where({ 'c.id': courseId, 's.id': stepId, 's.stepType': 'video', 's.videoId': videoId })
    .first('v.thumbnailStorageKey')
  return row?.thumbnailStorageKey ?? undefined
}

export function updateDraftFields(trx, versionId, { name, description }) {
  return trx('CourseVersion').where({ id: versionId }).update({ name, description })
}

export function touchCourse(trx, courseId) {
  return trx('Course').where({ id: courseId }).update({ updatedAt: db.raw('UTC_TIMESTAMP()') })
}

/** Removes steps and their answers (steps have no deletedAt in the ERD, research R7). */
export async function deleteSteps(trx, stepIds) {
  if (stepIds.length === 0) return
  await trx('Answer').whereIn('courseStepId', stepIds).del()
  await trx('CourseStep').whereIn('id', stepIds).del()
}

export function deleteAnswers(trx, answerIds) {
  if (answerIds.length === 0) return
  return trx('Answer').whereIn('id', answerIds).del()
}

export async function insertStep(trx, versionId, row) {
  const [id] = await trx('CourseStep').insert({ ...row, courseVersionId: versionId })
  return id
}

export function updateStep(trx, id, row) {
  return trx('CourseStep').where({ id }).update(row)
}

export async function insertAnswer(trx, courseStepId, row) {
  const [id] = await trx('Answer').insert({ ...row, courseStepId })
  return id
}

export function updateAnswer(trx, id, row) {
  return trx('Answer').where({ id }).update(row)
}
