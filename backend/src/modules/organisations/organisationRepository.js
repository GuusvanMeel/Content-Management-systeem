import { db } from '../../db/knex.js'

const PUBLIC_COLUMNS = ['id', 'name', 'loginCode', 'questLinkCode']

/** Active organisations only (constitution V), sorted by name (FR-007). */
export function listActive() {
  return db('Organisation').whereNull('deletedAt').orderBy('name').select(PUBLIC_COLUMNS)
}

export function findActiveById(id, trx = db) {
  return trx('Organisation').where({ id }).whereNull('deletedAt').first(PUBLIC_COLUMNS)
}

/** Includes passwordHash; only for logging in. */
export function findActiveByLoginCode(loginCode) {
  return db('Organisation')
    .where({ loginCode })
    .whereNull('deletedAt')
    .first('id', 'passwordHash')
}

/**
 * True when `code` equals the loginCode or questLinkCode of any organisation, deleted ones
 * included (FR-005, FR-012). `excludeId` only ignores that organisation's own loginCode.
 */
export async function isCodeTaken(code, { excludeId } = {}) {
  const row = await db('Organisation')
    .where((query) => {
      query.where((inner) => {
        inner.where('loginCode', code)
        if (excludeId) inner.whereNot('id', excludeId)
      })
      query.orWhere('questLinkCode', code)
    })
    .first('id')
  return Boolean(row)
}

export async function insertOrganisation(trx, row) {
  const [id] = await trx('Organisation').insert(row)
  return id
}

export function updateOrganisation(trx, id, changes) {
  return trx('Organisation').where({ id }).whereNull('deletedAt').update(changes)
}

export function updatePasswordHash(trx, id, passwordHash) {
  return trx('Organisation').where({ id }).whereNull('deletedAt').update({ passwordHash })
}

/** Soft delete (FR-011); returns 0 when the organisation does not exist or is already deleted. */
export function softDelete(trx, id) {
  return trx('Organisation')
    .where({ id })
    .whereNull('deletedAt')
    .update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
}
