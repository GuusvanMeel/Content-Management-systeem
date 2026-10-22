import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { FileStore } from '@tus/file-store'
import { Server } from '@tus/server'
import { config } from '../../config/env.js'
import { videoMessage } from '../../lib/videoMessages.js'
import { incomingDir } from '../../lib/videoStorage.js'
import { finaliseUpload, VideoRejectedError } from './videoService.js'

// tus endpoint for resumable video uploads (specs/002 research R1). Authorisation happens in
// videoUploadGuard before a request reaches this server (research R3).

export const UPLOADS_PATH = '/api/organisation/video-uploads'

/** tus sends `body` as-is; we use the API error format so the browser can show `message`. */
export function tusError(status, code, message) {
  return { status_code: status, body: JSON.stringify({ error: { code, message } }) }
}

/**
 * FileStore whose write keeps the "disk full" case apart. The stock FileStore turns every write
 * error into a generic 500; here ENOSPC removes the incomplete upload and answers 507 (research R6).
 */
export class VideoFileStore extends FileStore {
  async write(readable, fileId, offset) {
    try {
      return await this.writeChunk(readable, fileId, offset)
    } catch (err) {
      if (err?.code === 'ENOSPC') {
        await this.remove(fileId).catch(() => {})
        throw tusError(507, 'insufficient_storage', videoMessage('insufficient_storage'))
      }
      if (err?.status_code) throw err
      console.error('video upload write failed:', err)
      throw { status_code: 500, body: 'Something went wrong receiving the file\n' }
    }
  }

  /** Appends the request body at `offset`; same behaviour as FileStore.write, without wrapping errors. */
  async writeChunk(readable, fileId, offset) {
    let received = 0
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length
        callback(null, chunk)
      },
    })
    await pipeline(readable, counter, createWriteStream(this.resolve(fileId), { flags: 'r+', start: offset }))
    return offset + received
  }
}

// The guard creates incomingDir() before every new upload, so a removed directory is recreated.
export const datastore = new VideoFileStore({ directory: incomingDir() })

/** Removes the tus data file and its info. */
export async function removeUpload(id) {
  await datastore.remove(id).catch(() => {})
}

/** Removes only the tus info, after the data file was moved into storage. */
async function forgetUpload(id) {
  await datastore.configstore.delete(id)
}

/**
 * Sets the owner from the session. tus works on a copy of the request, so the guard leaves the
 * owner on the original Node request (req.runtime.node.req).
 */
async function onUploadCreate(req, upload) {
  const ownerId = req.runtime?.node?.req?.videoUploadOwnerId
  if (!ownerId) throw tusError(403, 'forbidden', 'Je hebt geen toegang tot deze pagina.')
  // Spreading first and setting organisationId last overwrites whatever the client sent.
  return { metadata: { ...(upload.metadata ?? {}), organisationId: String(ownerId) } }
}

async function onUploadFinish(_req, upload) {
  try {
    const video = await finaliseUpload(upload, { incomingDir: incomingDir(), removeUpload, forgetUpload })
    return { status_code: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video }) }
  } catch (err) {
    if (err instanceof VideoRejectedError) throw tusError(422, err.code, err.message)
    console.error('video upload finalisation failed:', err)
    throw tusError(500, 'internal_error', 'Er ging iets mis. Probeer het later opnieuw.')
  }
}

export const tusServer = new Server({
  path: UPLOADS_PATH,
  datastore,
  maxSize: config.VIDEO_MAX_SIZE_BYTES,
  respectForwardedHeaders: true,
  relativeLocation: true,
  onUploadCreate,
  onUploadFinish,
})

/** Path of an upload's data file; used by the guard and the cleanup job. */
export function uploadFilePath(id) {
  return path.join(incomingDir(), id)
}
