import { db } from '../../db/knex.js'

// Queries from specs/002 data-model.md. Every function takes the organisation id explicitly; it
// always comes from the session (FR-022). Soft-deleted rows are excluded (constitution V).

function requireId(organisationId) {
  if (!organisationId) throw new Error('organisationId is required')
}

const LIBRARY_COLUMNS = ['id', 'name', 'durationSeconds', 'fileSizeBytes', 'uploadedAt']

/** Inserts a verified video; `uploadedAt` is set by the database clock (UTC). Returns the row. */
export async function insertVideo(row) {
  requireId(row.ownerOrganisationId)
  const [id] = await db('Video').insert({ ...row, uploadedAt: db.raw('UTC_TIMESTAMP()') })
  return db('Video').select(LIBRARY_COLUMNS).where({ id }).first()
}

export function listActiveForOrganisation(organisationId) {
  requireId(organisationId)
  return db('Video')
    .select(LIBRARY_COLUMNS)
    .where({ ownerOrganisationId: organisationId })
    .whereNull('deletedAt')
    .orderBy([{ column: 'uploadedAt', order: 'desc' }, { column: 'id', order: 'desc' }])
}

export function findActiveOwn(id, organisationId) {
  requireId(organisationId)
  return db('Video')
    .where({ id, ownerOrganisationId: organisationId })
    .whereNull('deletedAt')
    .first()
}

/** Soft delete; returns the number of rows changed (0 = unknown, deleted or someone else's). */
export function softDeleteOwn(id, organisationId) {
  requireId(organisationId)
  return db('Video')
    .where({ id, ownerOrganisationId: organisationId })
    .whereNull('deletedAt')
    .update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
}
