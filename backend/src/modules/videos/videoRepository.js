import { db } from '../../db/knex.js'

// Queries from specs/002 and specs/003 data-model.md. Every function takes the organisation id
// explicitly; it always comes from the session. Soft-deleted rows are excluded (constitution V).

function requireId(organisationId) {
  if (!organisationId) throw new Error('organisationId is required')
}

const VIDEO_COLUMNS = [
  'v.id',
  'v.name',
  'v.description',
  'v.durationSeconds',
  'v.fileSizeBytes',
  'v.uploadedAt',
  'v.visibility',
  'v.ownerOrganisationId',
  'v.thumbnailStorageKey',
  'o.name as ownerName',
]

/**
 * The only definition of "videos this organisation may see" (specs/003 research R1): not deleted,
 * owner not deleted, and own, public, or selective with a VideoAccess row for the organisation.
 * Library, details, thumbnail, editing and deleting all start from this query.
 */
export function visibleVideosQuery(organisationId, trx = db) {
  requireId(organisationId)
  return trx('Video as v')
    .join('Organisation as o', 'o.id', 'v.ownerOrganisationId')
    .leftJoin('VideoAccess as a', function joinAccess() {
      this.on('a.videoId', '=', 'v.id').andOnVal('a.organisationId', '=', organisationId)
    })
    .whereNull('v.deletedAt')
    .whereNull('o.deletedAt')
    .where((query) =>
      query
        .where('v.ownerOrganisationId', organisationId)
        .orWhere('v.visibility', 'public')
        .orWhere((selective) => selective.where('v.visibility', 'selective').whereNotNull('a.videoId')),
    )
    .select(VIDEO_COLUMNS)
}

export function listVisible(organisationId) {
  return visibleVideosQuery(organisationId).orderBy([
    { column: 'v.uploadedAt', order: 'desc' },
    { column: 'v.id', order: 'desc' },
  ])
}

export function findVisible(id, organisationId, trx = db) {
  return visibleVideosQuery(organisationId, trx).where('v.id', id).first()
}

/** Inserts a verified video; `uploadedAt` is set by the database clock (UTC). Returns its id. */
export async function insertVideo(row, trx = db) {
  requireId(row.ownerOrganisationId)
  const [id] = await trx('Video').insert({ ...row, uploadedAt: db.raw('UTC_TIMESTAMP()') })
  return id
}

export function updateVideoFields(trx, id, changes) {
  return trx('Video').where({ id }).whereNull('deletedAt').update(changes)
}

/** Soft delete; returns the number of rows changed (0 = unknown, deleted or someone else's). */
export function softDeleteOwn(id, organisationId) {
  requireId(organisationId)
  return db('Video')
    .where({ id, ownerOrganisationId: organisationId })
    .whereNull('deletedAt')
    .update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
}

/** Removes every VideoAccess row of the video (when it stops being selective, FR-007). */
export function deleteAccess(trx, videoId) {
  return trx('VideoAccess').where({ videoId }).del()
}

/** Replaces the chosen organisations of a selective video. */
export async function replaceAccess(trx, videoId, organisationIds) {
  await deleteAccess(trx, videoId)
  if (organisationIds.length > 0) {
    await trx('VideoAccess').insert(organisationIds.map((organisationId) => ({ videoId, organisationId })))
  }
}

/** Active chosen organisations of a video, by name (research R11). */
export function listAccessOrganisations(videoId, trx = db) {
  return trx('VideoAccess as a')
    .join('Organisation as o', 'o.id', 'a.organisationId')
    .where('a.videoId', videoId)
    .whereNull('o.deletedAt')
    .orderBy('o.name')
    .select('o.id', 'o.name')
}
