import crypto from 'node:crypto'
import { db } from '../../db/knex.js'

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

/** Creates a session and returns the token for the cookie; only its hash is stored. */
export async function createSession({ administratorId = null, organisationId = null }) {
  const token = crypto.randomBytes(32).toString('base64url')
  await db('Session').insert({
    tokenHash: hashToken(token),
    administratorId,
    organisationId,
    createdAt: db.raw('UTC_TIMESTAMP()'),
    lastActivityAt: db.raw('UTC_TIMESTAMP()'),
  })
  return token
}

/**
 * Looks up a session by token. `expired` is computed by the database, so there is a single clock
 * (research R3). Also returns the administrator's username and whether the organisation is deleted.
 */
export async function findByToken(token, timeoutMinutes) {
  const row = await db('Session as s')
    .leftJoin('Administrator as a', 'a.id', 's.administratorId')
    .leftJoin('Organisation as o', 'o.id', 's.organisationId')
    .where('s.tokenHash', hashToken(token))
    .first(
      's.id',
      's.administratorId',
      's.organisationId',
      'a.username',
      'o.deletedAt as organisationDeletedAt',
      db.raw('s.lastActivityAt < UTC_TIMESTAMP() - INTERVAL ? MINUTE AS expired', [timeoutMinutes]),
    )
  return row ? { ...row, expired: Boolean(row.expired) } : null
}

/** Extends the session: every authenticated request counts as activity (FR-019). */
export function touch(id) {
  return db('Session').where({ id }).update({ lastActivityAt: db.raw('UTC_TIMESTAMP()') })
}

export function deleteById(id) {
  return db('Session').where({ id }).del()
}

export function deleteByToken(token) {
  return db('Session').where({ tokenHash: hashToken(token) }).del()
}

/** Ends all sessions of an organisation (FR-010). */
export function deleteByOrganisationId(organisationId, trx = db) {
  return trx('Session').where({ organisationId }).del()
}

/** Removes expired sessions and returns how many were removed (FR-019b). */
export function deleteExpired(timeoutMinutes) {
  return db('Session')
    .where('lastActivityAt', '<', db.raw('UTC_TIMESTAMP() - INTERVAL ? MINUTE', [timeoutMinutes]))
    .del()
}
