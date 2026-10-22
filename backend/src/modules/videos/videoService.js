import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../../lib/errors.js'
import * as videoStorage from '../../lib/videoStorage.js'
import { makeThumbnail, probeVideo, VideoRejectedError } from '../../lib/videoVerification.js'
import * as repo from './videoRepository.js'

const NAME_MAX = 255

/** The shape of a video in every API response (contracts/api.md). */
export function toVideoDto(row) {
  return {
    id: row.id,
    name: row.name,
    durationSeconds: row.durationSeconds,
    fileSizeBytes: Number(row.fileSizeBytes),
    uploadedAt: new Date(row.uploadedAt).toISOString(),
    thumbnailUrl: `/api/organisation/videos/${row.id}/thumbnail`,
  }
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
 * Runs right after the last chunk (research R4): verifies the file, creates the thumbnail, moves
 * both into storage and inserts the row. Only a valid video gets a row (FR-013, FR-016). On a
 * rejection everything is removed and the VideoRejectedError is passed on (FR-014).
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
    const row = await repo.insertVideo({
      ownerOrganisationId: organisationId,
      name: resolveName(upload.metadata?.name, upload.metadata?.filename),
      description: null,
      ...keys,
      fileSizeBytes: upload.size,
      durationSeconds,
      visibility: 'private',
    })
    await forgetUpload(upload.id)
    return toVideoDto(row)
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

export async function listVideos(organisationId) {
  const rows = await repo.listActiveForOrganisation(organisationId)
  return rows.map(toVideoDto)
}

const notFound = () => new AppError(404, 'not_found', 'Niet gevonden.')

/** Thumbnail key of an own, not deleted video; otherwise 404 (FR-022). */
export async function getThumbnailKey(id, organisationId) {
  const row = await repo.findActiveOwn(id, organisationId)
  if (!row?.thumbnailStorageKey) throw notFound()
  return row.thumbnailStorageKey
}

/** Soft delete; files stay on disk (FR-020). */
export async function deleteVideo(id, organisationId) {
  const changed = await repo.softDeleteOwn(id, organisationId)
  if (changed === 0) throw notFound()
}
