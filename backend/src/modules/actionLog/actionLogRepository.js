import { db } from '../../db/knex.js'

/**
 * Writes one log entry inside the transaction of the action itself (research R11).
 * There are deliberately no functions to change or delete entries (FR-028).
 */
export function insertEntry(trx, { administratorId, organisationId, action, details = null }) {
  return trx('AdminActionLog').insert({
    administratorId,
    organisationId,
    action,
    details: details === null ? null : JSON.stringify(details),
    createdAt: db.raw('UTC_TIMESTAMP()'),
  })
}

export async function listEntries({ limit, offset }) {
  const [{ total }] = await db('AdminActionLog').count({ total: '*' })
  const rows = await db('AdminActionLog as l')
    .join('Administrator as a', 'a.id', 'l.administratorId')
    .join('Organisation as o', 'o.id', 'l.organisationId')
    .select(
      'l.id',
      'l.createdAt',
      'l.action',
      'l.details',
      'a.username as administrator',
      'o.id as organisationId',
      'o.name as organisationName',
      'o.deletedAt as organisationDeletedAt',
    )
    .orderBy([
      { column: 'l.createdAt', order: 'desc' },
      { column: 'l.id', order: 'desc' },
    ])
    .limit(limit)
    .offset(offset)
  return { total: Number(total), rows }
}
