import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../../config/env.js'
import { db } from '../../db/knex.js'
import { AppError, validationError } from '../../lib/errors.js'
import {
  keepActiveOrganisations,
  normalizeDescription,
  parseOrganisationIds,
  validateAccessOrganisations,
  validateName,
  validateVisibility,
  VISIBILITIES,
} from '../../lib/videoChoices.js'
import * as videoStorage from '../../lib/videoStorage.js'
import { makeThumbnail, probeVideo, VideoRejectedError } from '../../lib/videoVerification.js'
import * as repo from './videoRepository.js'

const NAME_MAX = 255

const notFound = () => new AppError(404, 'not_found', 'Niet gevonden.')
const notOwner = () =>
  new AppError(403, 'not_owner', 'Alleen de organisatie die deze video heeft geüpload, kan hem wijzigen of verwijderen.')

/**
 * The shape of a video in every API response (specs/003 contracts/api.md). Only the owner sees
 * the availability; other organisations never learn with whom a video is shared (FR-006).
 */
export function toVideoDto(row, organisationId) {
  const isOwn = row.ownerOrganisationId === organisationId
  const dto = {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    durationSeconds: row.durationSeconds,
    fileSizeBytes: Number(row.fileSizeBytes),
    uploadedAt: new Date(row.uploadedAt).toISOString(),
    thumbnailUrl: `/api/organisation/videos/${row.id}/thumbnail`,
    owner: { id: row.ownerOrganisationId, name: row.ownerName, isOwn },
  }
  if (isOwn) dto.visibility = row.visibility
  return dto
}

/**
 * The name typed by the teacher; without one, the file name without .mp4, cut to 255
 * characters; if nothing is left, "Video" (FR-005). The guard already refused a typed name over 255.
 */
export function resolveName(name, filename) {
  const typed = (name ?? '').trim()
  if (typed) return typed
  const fromFile = (filename ?? '').replace(/\.mp4$/i, '').trim().slice(0, NAME_MAX).trim()
  return fromFile || 'Video'
}

/**
 * Availability and description from the upload metadata, checked again at the end of the upload
 * (specs/003 research R4). The guard refused invalid choices already; organisations deleted since
 * then are dropped, and a selective video without any organisation left becomes private.
 */
export async function resolveUploadChoices(metadata = {}, ownerOrganisationId, trx = db) {
  const visibility = VISIBILITIES.includes(metadata.visibility) ? metadata.visibility : config.VIDEO_DEFAULT_VISIBILITY
  let description = null
  try {
    description = normalizeDescription(metadata.description)
  } catch {
    // Already refused by the guard; never fail a verified upload on it.
  }
  if (visibility !== 'selective') return { visibility, description, accessOrganisationIds: [] }

  let ids
  try {
    ids = parseOrganisationIds(metadata.accessOrganisationIds)
  } catch {
    ids = []
  }
  const kept = await keepActiveOrganisations(ids, ownerOrganisationId, trx)
  if (kept.length === 0) return { visibility: 'private', description, accessOrganisationIds: [] }
  return { visibility, description, accessOrganisationIds: kept }
}

/**
 * Runs right after the last chunk (specs/002 research R4): verifies the file, creates the
 * thumbnail, moves both into storage and inserts the row together with the chosen organisations.
 * Only a valid video gets a row (FR-013, FR-016). On a rejection everything is removed and the
 * VideoRejectedError is passed on (FR-014).
 *
 * `removeUpload(id)` removes the tus data and info; `forgetUpload(id)` removes only the info,
 * after the data file has been moved into storage.
 */
export async function finaliseUpload(upload, { incomingDir, removeUpload, forgetUpload }) {
  const organisationId = Number(upload.metadata?.organisationId)
  if (!Number.isInteger(organisationId) || organisationId <= 0) {
    await removeUpload(upload.id)
    throw new Error(`Upload ${upload.id} has no owner`)
  }
  const source = path.join(incomingDir, upload.id)
  const thumbnailTemp = path.join(incomingDir, `${upload.id}.thumb.jpg`)

  let durationSeconds
  try {
    ;({ durationSeconds } = await probeVideo(source))
    await makeThumbnail(source, thumbnailTemp, durationSeconds)
  } catch (err) {
    await removeUpload(upload.id)
    await removeFile(thumbnailTemp)
    throw err
  }

  const keys = videoStorage.newVideoKeys(organisationId)
  const saved = []
  try {
    await videoStorage.save(keys.thumbnailStorageKey, thumbnailTemp)
    saved.push(keys.thumbnailStorageKey)
    await videoStorage.save(keys.storageKey, source)
    saved.push(keys.storageKey)
    const id = await db.transaction(async (trx) => {
      const choices = await resolveUploadChoices(upload.metadata, organisationId, trx)
      const videoId = await repo.insertVideo(
        {
          ownerOrganisationId: organisationId,
          name: resolveName(upload.metadata?.name, upload.metadata?.filename),
          description: choices.description,
          ...keys,
          fileSizeBytes: upload.size,
          durationSeconds,
          visibility: choices.visibility,
        },
        trx,
      )
      await repo.replaceAccess(trx, videoId, choices.accessOrganisationIds)
      return videoId
    })
    await forgetUpload(upload.id)
    return toVideoDto(await repo.findVisible(id, organisationId), organisationId)
  } catch (err) {
    // Do not leave files behind that no row points to.
    for (const key of saved) await videoStorage.remove(key)
    await removeUpload(upload.id)
    await removeFile(thumbnailTemp)
    throw err
  }
}

async function removeFile(file) {
  try {
    await unlink(file)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

export { VideoRejectedError }

/** Every video this organisation may see, newest first (FR-008). */
export async function listVideos(organisationId) {
  const rows = await repo.listVisible(organisationId)
  return rows.map((row) => toVideoDto(row, organisationId))
}

/** Details of a visible video; the owner also gets the chosen organisations (FR-012). */
export async function getVideoDetails(id, organisationId) {
  const row = await repo.findVisible(id, organisationId)
  if (!row) throw notFound()
  const dto = toVideoDto(row, organisationId)
  if (dto.owner.isOwn && row.visibility === 'selective') {
    dto.accessOrganisations = await repo.listAccessOrganisations(id)
  }
  return dto
}

/** Thumbnail key of a visible video; anything else is "not found" (FR-013). */
export async function getThumbnailKey(id, organisationId) {
  const row = await repo.findVisible(id, organisationId)
  if (!row?.thumbnailStorageKey) throw notFound()
  return row.thumbnailStorageKey
}

/** A visible video owned by the organisation, else 404 (not visible) or 403 (someone else's). */
async function findOwnVisible(id, organisationId) {
  const row = await repo.findVisible(id, organisationId)
  if (!row) throw notFound()
  if (row.ownerOrganisationId !== organisationId) throw notOwner()
  return row
}

/** Soft delete by the owner; files stay on disk (specs/002 FR-020, research R9). */
export async function deleteVideo(id, organisationId) {
  await findOwnVisible(id, organisationId)
  const changed = await repo.softDeleteOwn(id, organisationId)
  if (changed === 0) throw notFound()
}

/** Runs every check and merges their field errors into one validation error. */
function collectErrors(checks) {
  const fields = {}
  const results = {}
  for (const [key, check] of Object.entries(checks)) {
    try {
      results[key] = check()
    } catch (err) {
      if (err.code !== 'validation_failed') throw err
      Object.assign(fields, err.fields)
    }
  }
  return { results, fields }
}

const EDITABLE = ['name', 'description', 'visibility', 'accessOrganisationIds']

/**
 * Changes name, description and/or availability of an own video (FR-012a, FR-014 – FR-017).
 * Leaving "selective" removes the chosen organisations (FR-007). One transaction.
 */
export async function updateVideo(id, organisationId, body = {}) {
  const row = await findOwnVisible(id, organisationId)
  const sent = EDITABLE.filter((key) => body[key] !== undefined)
  if (sent.length === 0) throw validationError({ name: 'Wijzig minstens één gegeven.' })

  const checks = {}
  if (sent.includes('name')) checks.name = () => validateName(body.name)
  if (sent.includes('description')) checks.description = () => normalizeDescription(body.description)
  if (sent.includes('visibility')) checks.visibility = () => validateVisibility(body.visibility)
  if (sent.includes('accessOrganisationIds')) checks.accessOrganisationIds = () => parseOrganisationIds(body.accessOrganisationIds)
  const { results, fields } = collectErrors(checks)

  const visibility = results.visibility ?? row.visibility
  let accessIds = null
  if (visibility === 'selective' && !fields.accessOrganisationIds) {
    if (sent.includes('accessOrganisationIds')) {
      try {
        accessIds = await validateAccessOrganisations(results.accessOrganisationIds, organisationId)
      } catch (err) {
        if (err.code !== 'validation_failed') throw err
        Object.assign(fields, err.fields)
      }
    } else if (row.visibility !== 'selective') {
      fields.accessOrganisationIds = 'Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.'
    }
  }
  if (Object.keys(fields).length > 0) throw validationError(fields)

  const changes = {}
  if ('name' in results) changes.name = results.name
  if ('description' in results) changes.description = results.description
  if ('visibility' in results) changes.visibility = results.visibility

  await db.transaction(async (trx) => {
    if (Object.keys(changes).length > 0) await repo.updateVideoFields(trx, id, changes)
    if (visibility === 'selective') {
      if (accessIds) await repo.replaceAccess(trx, id, accessIds)
    } else {
      await repo.deleteAccess(trx, id)
    }
  })
  return getVideoDetails(id, organisationId)
}
