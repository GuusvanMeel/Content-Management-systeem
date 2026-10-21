import argon2 from 'argon2'
import { validationError } from './errors.js'

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

/** Returns a customer-facing error message, or null when the password is acceptable (FR-013). */
export function passwordProblem(plain) {
  if (typeof plain !== 'string' || plain.length < PASSWORD_MIN_LENGTH) {
    return 'Het wachtwoord moet minimaal 10 tekens zijn.'
  }
  if (plain.length > PASSWORD_MAX_LENGTH) return 'Het wachtwoord mag maximaal 128 tekens zijn.'
  return null
}

export function validatePassword(plain) {
  const problem = passwordProblem(plain)
  if (problem) throw validationError({ password: problem })
}

export function hashPassword(plain) {
  return argon2.hash(plain, { type: argon2.argon2id })
}

export async function verifyPassword(hash, plain) {
  if (typeof plain !== 'string') return false
  try {
    return await argon2.verify(hash, plain)
  } catch {
    return false
  }
}

let dummyHash

/**
 * Runs a verification that always fails, so an unknown user name or code takes as long as a
 * wrong password and the response time does not reveal which one it was (FR-017).
 */
export async function verifyDummyPassword(plain) {
  dummyHash ??= await hashPassword('timing-equaliser-not-a-real-password')
  await verifyPassword(dummyHash, String(plain ?? ''))
  return false
}
