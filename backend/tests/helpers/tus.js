import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Helpers that speak the tus 1.0 protocol with a Supertest agent (specs/002 contracts/api.md).

export const UPLOADS_PATH = '/api/organisation/video-uploads'
export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/videos/', import.meta.url))

const b64 = (value) => Buffer.from(String(value), 'utf8').toString('base64')

export function encodeMetadata(fields) {
  return Object.entries(fields)
    .map(([key, value]) => (value === '' ? `${key}` : `${key} ${b64(value)}`))
    .join(',')
}

export function readFixture(fileName) {
  return readFile(path.join(FIXTURES_DIR, fileName))
}

/** POST: creates an upload. Returns the response and the upload path (from Location). */
export async function createUpload(agent, { size, filename = 'video.mp4', name = '', extraMetadata = {} }) {
  const response = await agent
    .post(UPLOADS_PATH)
    .set('Tus-Resumable', '1.0.0')
    .set('Upload-Length', String(size))
    .set('Upload-Metadata', encodeMetadata({ filename, name, ...extraMetadata }))
  const location = response.headers.location
  const url = location ? new URL(location, 'http://localhost').pathname : undefined
  return { response, url }
}

export function headUpload(agent, url) {
  return agent.head(url).set('Tus-Resumable', '1.0.0')
}

export function patchChunk(agent, url, offset, buffer) {
  return agent
    .patch(url)
    .set('Tus-Resumable', '1.0.0')
    .set('Upload-Offset', String(offset))
    .set('Content-Type', 'application/offset+octet-stream')
    .send(buffer)
}

export function deleteUpload(agent, url) {
  return agent.delete(url).set('Tus-Resumable', '1.0.0')
}

/**
 * Uploads a buffer in chunks from `startOffset` and returns the response of the last PATCH
 * (or the first one that fails).
 */
export async function sendChunks(agent, url, buffer, { startOffset = 0, chunkSize = 64 * 1024, until = buffer.length } = {}) {
  let offset = startOffset
  let response
  while (offset < until) {
    const end = Math.min(offset + chunkSize, until)
    response = await patchChunk(agent, url, offset, buffer.subarray(offset, end))
    if (response.status !== 204) return response
    offset = end
  }
  return response
}

/** Uploads a fixture completely; returns `{ create, last, url }`. */
export async function uploadFixture(agent, fileName, { chunkSize = 64 * 1024, name = '', filename = fileName } = {}) {
  const buffer = await readFixture(fileName)
  const { response: create, url } = await createUpload(agent, { size: buffer.length, filename, name })
  if (create.status !== 201) return { create, last: create, url }
  const last = await sendChunks(agent, url, buffer, { chunkSize })
  return { create, last, url }
}
