import crypto from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../../config/env.js'
import { defaultStyle } from '../../config/defaultStyle.js'
import { validationError } from '../../lib/errors.js'
import { detectLogoType } from '../../lib/logoValidation.js'
import * as repo from './styleRepository.js'

const COLOUR_PATTERN = /^#[0-9A-F]{6}$/
const COLOUR_FIELDS = ['primaryColour', 'secondaryColour']

export const logosDir = () => path.join(config.UPLOADS_DIR, 'logos')

async function removeLogoFile(fileName) {
  if (!fileName) return
  try {
    await unlink(path.join(logosDir(), fileName))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

/** A row with all three parts empty means "no style", so it is removed. */
async function saveOrRemove(organisationId, current, changes) {
  const next = { ...current, ...changes }
  if (!next.primaryColour && !next.secondaryColour && !next.logoImage) {
    await repo.deleteByOrganisationId(organisationId)
  } else {
    await repo.upsertStyle(organisationId, changes)
  }
}

/** Own value per part, otherwise the default (FR-024). */
export async function getEffectiveStyle(organisationId) {
  const row = await repo.findByOrganisationId(organisationId)
  return {
    primaryColour: { value: row?.primaryColour ?? defaultStyle.primaryColour, isDefault: !row?.primaryColour },
    secondaryColour: {
      value: row?.secondaryColour ?? defaultStyle.secondaryColour,
      isDefault: !row?.secondaryColour,
    },
    logo: {
      url: row?.logoImage ? `/media/logos/${row.logoImage}` : defaultStyle.logoUrl,
      isDefault: !row?.logoImage,
    },
  }
}

/** `null` resets a colour to the default; a missing key leaves it unchanged. */
export async function updateColours(organisationId, body = {}) {
  const changes = {}
  const fields = {}
  for (const key of COLOUR_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]
    if (value === null) {
      changes[key] = null
    } else if (typeof value === 'string' && COLOUR_PATTERN.test(value.toUpperCase())) {
      changes[key] = value.toUpperCase()
    } else {
      fields[key] = 'Gebruik een kleur in de vorm #RRGGBB.'
    }
  }
  if (Object.keys(fields).length > 0) throw validationError(fields)
  if (Object.keys(changes).length > 0) {
    const current = await repo.findByOrganisationId(organisationId)
    await saveOrRemove(organisationId, current, changes)
  }
  return getEffectiveStyle(organisationId)
}

/** Stores the new logo first and removes the old file only after the database points to the new one. */
export async function replaceLogo(organisationId, buffer) {
  const extension = detectLogoType(buffer)
  const fileName = `${crypto.randomUUID()}.${extension}`
  await mkdir(logosDir(), { recursive: true })
  await writeFile(path.join(logosDir(), fileName), buffer)

  let previous
  try {
    previous = await repo.findByOrganisationId(organisationId)
    await repo.upsertStyle(organisationId, { logoImage: fileName })
  } catch (err) {
    await removeLogoFile(fileName)
    throw err
  }
  await removeLogoFile(previous?.logoImage)
  return getEffectiveStyle(organisationId)
}

export async function removeLogo(organisationId) {
  const current = await repo.findByOrganisationId(organisationId)
  if (current?.logoImage) {
    await saveOrRemove(organisationId, current, { logoImage: null })
    await removeLogoFile(current.logoImage)
  }
  return getEffectiveStyle(organisationId)
}

export async function resetStyle(organisationId) {
  const current = await repo.findByOrganisationId(organisationId)
  if (current) {
    await repo.deleteByOrganisationId(organisationId)
    await removeLogoFile(current.logoImage)
  }
  return getEffectiveStyle(organisationId)
}
