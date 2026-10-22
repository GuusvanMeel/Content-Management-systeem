import { mkdir } from 'node:fs/promises'
import { config } from '../../config/env.js'
import { AppError, validationError } from '../../lib/errors.js'
import * as videoStorage from '../../lib/videoStorage.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'
import { datastore, INSUFFICIENT_STORAGE_MESSAGE, removeUpload } from './tusServer.js'

// Runs before the tus server for every upload request (specs/002 research R3, R5, R6). The tus
// server itself knows nothing about organisations.

const NAME_MAX = 255
const UPLOAD_ID = /^[0-9a-f]{16,64}$/

const notFound = () => new AppError(404, 'not_found', 'Niet gevonden.')
const insufficientStorage = () => new AppError(507, 'insufficient_storage', INSUFFICIENT_STORAGE_MESSAGE)

/** Parses a tus Upload-Metadata header ("key base64,key2 base64,key3") into a plain object. */
export function parseMetadata(header) {
  const result = {}
  if (!header) return result
  for (const pair of header.split(',')) {
    const [key, value] = pair.trim().split(' ')
    if (!key) continue
    result[key] = value === undefined ? '' : Buffer.from(value, 'base64').toString('utf8')
  }
  return result
}

async function hasRoomFor(bytes) {
  return (await videoStorage.freeBytes()) - bytes >= config.VIDEO_MIN_FREE_SPACE_BYTES
}

async function guardCreate(req) {
  const length = Number(req.get('Upload-Length'))
  if (!req.get('Upload-Length') || !Number.isSafeInteger(length) || length <= 0) {
    throw new AppError(400, 'upload_length_required', 'Dit verzoek is ongeldig.')
  }
  if (length > config.VIDEO_MAX_SIZE_BYTES) {
    throw new AppError(413, 'video_too_large', `Een video mag maximaal ${config.VIDEO_MAX_SIZE_GB} GB zijn.`)
  }

  const metadata = parseMetadata(req.get('Upload-Metadata'))
  if (!/\.mp4$/i.test(metadata.filename ?? '')) {
    throw new AppError(415, 'video_unsupported_format', "Alleen MP4-video's (H.264) worden ondersteund.")
  }
  if ((metadata.name ?? '').trim().length > NAME_MAX) {
    throw validationError({ name: 'De naam mag maximaal 255 tekens lang zijn.' })
  }
  if (!(await hasRoomFor(length))) throw insufficientStorage()

  // The owner always comes from the session; tusServer's onUploadCreate writes it into the
  // upload metadata and drops whatever the client sent (FR-021, FR-022).
  req.videoUploadOwnerId = getOrganisationId(req)
  await mkdir(videoStorage.incomingDir(), { recursive: true })
}

async function guardExisting(req, uploadId) {
  if (!UPLOAD_ID.test(uploadId)) throw notFound()
  let upload
  try {
    upload = await datastore.getUpload(uploadId)
  } catch {
    throw notFound()
  }
  // Same answer for "unknown" and "someone else's", so nothing leaks about other uploads.
  if (Number(upload.metadata?.organisationId) !== getOrganisationId(req)) throw notFound()

  if (req.method === 'PATCH' && !(await hasRoomFor((upload.size ?? 0) - (upload.offset ?? 0)))) {
    await removeUpload(uploadId)
    throw insufficientStorage()
  }
}

export async function videoUploadGuard(req, _res, next) {
  const uploadId = req.params.uploadId
  if (uploadId === undefined) {
    if (req.method === 'POST') await guardCreate(req)
    else if (req.method !== 'OPTIONS') throw notFound()
  } else {
    await guardExisting(req, uploadId)
  }
  next()
}
