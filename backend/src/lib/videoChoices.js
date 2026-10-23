import { config } from '../config/env.js'
import { db } from '../db/knex.js'
import { validationError } from './errors.js'

// Rules for name, description, availability and chosen organisations, shared by the upload guard,
// the end of an upload and editing a video (specs/003 research R5). Messages are customer-facing.

export const VISIBILITIES = ['public', 'selective', 'private']
const NAME_MAX = 255

const MESSAGES = {
  nameRequired: 'Vul een naam in.',
  nameTooLong: 'De naam mag maximaal 255 tekens lang zijn.',
  descriptionTooLong: `De beschrijving mag maximaal ${config.VIDEO_DESCRIPTION_MAX_LENGTH} tekens zijn.`,
  visibility: 'Kies een beschikbaarheid.',
  noOrganisations: 'Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.',
  unknownOrganisations: 'Kies alleen organisaties uit de lijst.',
}

/** Length in Unicode code points, the same way the browser counts (research R5). */
export const characterCount = (text) => [...text].length

export function validateName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name) throw validationError({ name: MESSAGES.nameRequired })
  if (characterCount(name) > NAME_MAX) throw validationError({ name: MESSAGES.nameTooLong })
  return name
}

/** Trimmed text with \n line breaks, or null when there is no description (FR-020). */
export function normalizeDescription(raw) {
  if (raw === null || raw === undefined) return null
  const text = String(raw).replace(/\r\n?/g, '\n').trim()
  if (!text) return null
  if (characterCount(text) > config.VIDEO_DESCRIPTION_MAX_LENGTH) {
    throw validationError({ description: MESSAGES.descriptionTooLong })
  }
  return text
}

export function validateVisibility(raw) {
  if (!VISIBILITIES.includes(raw)) throw validationError({ visibility: MESSAGES.visibility })
  return raw
}

/** A comma-separated string or an array of ids → unique positive whole numbers. */
export function parseOrganisationIds(raw) {
  if (raw === undefined || raw === null || raw === '') return []
  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const ids = []
  for (const part of parts) {
    const text = String(part).trim()
    if (!/^[1-9]\d{0,9}$/.test(text)) throw validationError({ accessOrganisationIds: MESSAGES.unknownOrganisations })
    const id = Number(text)
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/** The ids that belong to active organisations other than the owner. */
export async function keepActiveOrganisations(ids, ownerOrganisationId, trx = db) {
  if (ids.length === 0) return []
  const rows = await trx('Organisation').whereIn('id', ids).whereNull('deletedAt').select('id')
  const active = new Set(rows.map((row) => row.id))
  return ids.filter((id) => active.has(id) && id !== ownerOrganisationId)
}

/**
 * For "Selectief beschikbaar": at least one organisation, and only active organisations other
 * than the owner (FR-004). Returns the checked ids.
 */
export async function validateAccessOrganisations(ids, ownerOrganisationId, trx = db) {
  if (ids.length === 0) throw validationError({ accessOrganisationIds: MESSAGES.noOrganisations })
  const kept = await keepActiveOrganisations(ids, ownerOrganisationId, trx)
  if (kept.length !== ids.length) throw validationError({ accessOrganisationIds: MESSAGES.unknownOrganisations })
  return kept
}
