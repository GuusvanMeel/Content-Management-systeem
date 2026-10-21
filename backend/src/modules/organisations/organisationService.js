import { db } from '../../db/knex.js'
import {
  generateQuestLinkCode,
  isValidLoginCode,
  normalizeLoginCode,
  suggestLoginCodeBase,
} from '../../lib/codes.js'
import { conflict, notFound, validationError } from '../../lib/errors.js'
import { hashPassword, passwordProblem, validatePassword } from '../../lib/password.js'
import { insertEntry } from '../actionLog/actionLogRepository.js'
import { deleteByOrganisationId } from '../auth/sessionRepository.js'
import * as repo from './organisationRepository.js'

const MESSAGES = {
  nameRequired: 'Vul een naam in.',
  nameTooLong: 'De naam mag maximaal 255 tekens zijn.',
  codeInvalid:
    'Gebruik 3 tot 50 tekens: letters, cijfers en streepjes, niet beginnend of eindigend met een streepje.',
  codeTaken: 'Deze code is al in gebruik.',
  nothingToChange: 'Vul een naam of organisatiecode in.',
}

function nameProblem(name) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed.length === 0) return MESSAGES.nameRequired
  if (trimmed.length > 255) return MESSAGES.nameTooLong
  return null
}

const isDuplicateEntry = (err) => err?.code === 'ER_DUP_ENTRY'

async function generateUniqueQuestLinkCode() {
  for (;;) {
    const code = generateQuestLinkCode()
    if (!(await repo.isCodeTaken(code))) return code
  }
}

/** A free login code derived from the name, with -2, -3, ... when needed (FR-004a). */
export async function suggestCode(name) {
  const base = suggestLoginCodeBase(name)
  if (!isValidLoginCode(base)) {
    throw validationError({ name: 'Vul een naam in waar een code van gemaakt kan worden.' })
  }
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    if (!(await repo.isCodeTaken(candidate))) return candidate
  }
}

export async function createOrganisation({ name, loginCode, password }, administratorId) {
  const code = normalizeLoginCode(loginCode)
  const fields = {}
  const nameError = nameProblem(name)
  if (nameError) fields.name = nameError
  if (!isValidLoginCode(code)) fields.loginCode = MESSAGES.codeInvalid
  const passwordError = passwordProblem(password)
  if (passwordError) fields.password = passwordError
  if (Object.keys(fields).length > 0) throw validationError(fields)

  if (await repo.isCodeTaken(code)) throw conflict({ loginCode: MESSAGES.codeTaken })

  const row = {
    name: name.trim(),
    loginCode: code,
    passwordHash: await hashPassword(password),
    questLinkCode: await generateUniqueQuestLinkCode(),
  }
  try {
    return await db.transaction(async (trx) => {
      const id = await repo.insertOrganisation(trx, row)
      await insertEntry(trx, {
        administratorId,
        organisationId: id,
        action: 'create',
        details: { name: row.name, loginCode: row.loginCode },
      })
      return { id, name: row.name, loginCode: row.loginCode, questLinkCode: row.questLinkCode }
    })
  } catch (err) {
    if (isDuplicateEntry(err)) throw conflict({ loginCode: MESSAGES.codeTaken })
    throw err
  }
}

export async function getOrganisation(id) {
  const organisation = await repo.findActiveById(id)
  if (!organisation) throw notFound()
  return organisation
}

/** Changes name and/or code; a changed code ends all sessions of the organisation (FR-008, FR-010). */
export async function updateOrganisation(id, { name, loginCode } = {}, administratorId) {
  if (name === undefined && loginCode === undefined) {
    throw validationError({ name: MESSAGES.nothingToChange })
  }
  const current = await getOrganisation(id)

  const changes = {}
  const details = {}
  const fields = {}
  if (name !== undefined) {
    const error = nameProblem(name)
    if (error) fields.name = error
    else if (name.trim() !== current.name) {
      changes.name = name.trim()
      details.name = { old: current.name, new: changes.name }
    }
  }
  if (loginCode !== undefined) {
    const code = normalizeLoginCode(loginCode)
    if (!isValidLoginCode(code)) fields.loginCode = MESSAGES.codeInvalid
    else if (code !== current.loginCode) {
      changes.loginCode = code
      details.loginCode = { old: current.loginCode, new: code }
    }
  }
  if (Object.keys(fields).length > 0) throw validationError(fields)
  if (Object.keys(changes).length === 0) return current

  if (changes.loginCode && (await repo.isCodeTaken(changes.loginCode, { excludeId: id }))) {
    throw conflict({ loginCode: MESSAGES.codeTaken })
  }

  try {
    await db.transaction(async (trx) => {
      const updated = await repo.updateOrganisation(trx, id, changes)
      if (updated === 0) throw notFound()
      if (changes.loginCode) await deleteByOrganisationId(id, trx)
      await insertEntry(trx, { administratorId, organisationId: id, action: 'update', details })
    })
  } catch (err) {
    if (isDuplicateEntry(err)) throw conflict({ loginCode: MESSAGES.codeTaken })
    throw err
  }
  return { ...current, ...changes }
}

/** Running sessions stay valid after a password reset (FR-009, FR-010). */
export async function resetPassword(id, password, administratorId) {
  await getOrganisation(id)
  validatePassword(password)
  const passwordHash = await hashPassword(password)
  await db.transaction(async (trx) => {
    const updated = await repo.updatePasswordHash(trx, id, passwordHash)
    if (updated === 0) throw notFound()
    await insertEntry(trx, { administratorId, organisationId: id, action: 'passwordReset' })
  })
}

/** Soft delete: ends all sessions and keeps the code reserved (FR-010 – FR-012). */
export async function deleteOrganisation(id, administratorId) {
  await db.transaction(async (trx) => {
    const deleted = await repo.softDelete(trx, id)
    if (deleted === 0) throw notFound()
    await deleteByOrganisationId(id, trx)
    await insertEntry(trx, { administratorId, organisationId: id, action: 'delete' })
  })
}
