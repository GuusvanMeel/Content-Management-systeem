import { db } from '../../db/knex.js'
import { normalizeLoginCode } from '../../lib/codes.js'
import { invalidCredentials } from '../../lib/errors.js'
import { verifyDummyPassword, verifyPassword } from '../../lib/password.js'
import { findActiveByLoginCode } from '../organisations/organisationRepository.js'
import { createSession } from './sessionRepository.js'

// No lockout or delay after failed attempts (FR-018); every attempt is judged on its own.
// Login attempts are not logged (FR-029).

/** Returns a new session token, or throws one generic error for any failure (FR-001, FR-017). */
export async function loginAdmin(username, password) {
  const admin =
    typeof username === 'string'
      ? await db('Administrator').where({ username: username.trim() }).first('id', 'passwordHash')
      : undefined
  const valid = admin ? await verifyPassword(admin.passwordHash, password) : await verifyDummyPassword(password)
  if (!valid) throw invalidCredentials('Gebruikersnaam of wachtwoord onjuist.')
  return createSession({ administratorId: admin.id })
}

/**
 * Deleted organisations and Quest link codes are not found by findActiveByLoginCode, so they get
 * the same generic error (FR-012, FR-015, FR-017).
 */
export async function loginOrganisation(loginCode, password) {
  const code = normalizeLoginCode(loginCode)
  const organisation = code ? await findActiveByLoginCode(code) : undefined
  const valid = organisation
    ? await verifyPassword(organisation.passwordHash, password)
    : await verifyDummyPassword(password)
  if (!valid) throw invalidCredentials('Organisatiecode of wachtwoord onjuist.')
  return createSession({ organisationId: organisation.id })
}
