import crypto from 'node:crypto'
import { mkdir, rename, statfs, unlink } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/env.js'

// The only module that touches video and thumbnail files (specs/002 research R2). Callers work
// with storage keys, never with paths, so the storage can be replaced later without touching
// the rest of the code. Keys never contain user input.

const KEY_PATTERN = /^(videos|thumbnails)\/\d+\/[0-9a-f-]{36}\.(mp4|jpg)$/

function assertKey(key) {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    throw new Error(`Invalid storage key: ${key}`)
  }
}

/** Directory where tus keeps incomplete uploads; on the same volume, so save() is a rename. */
export function incomingDir() {
  return path.join(config.VIDEOS_DIR, 'incoming')
}

/** New keys for one video and its thumbnail. */
export function newVideoKeys(organisationId) {
  const id = crypto.randomUUID()
  return {
    storageKey: `videos/${organisationId}/${id}.mp4`,
    thumbnailStorageKey: `thumbnails/${organisationId}/${id}.jpg`,
  }
}

export function getPath(key) {
  assertKey(key)
  return path.join(config.VIDEOS_DIR, ...key.split('/'))
}

/** Path for X-Accel-Redirect; nginx maps /internal/videos/ to the videos volume. */
export function getInternalUrl(key) {
  assertKey(key)
  return `/internal/videos/${key}`
}

/** Moves a file into storage under `key`. */
export async function save(key, sourcePath) {
  const target = getPath(key)
  await mkdir(path.dirname(target), { recursive: true })
  await rename(sourcePath, target)
}

/** Removes a stored file; a file that is already gone is not an error. Returns whether a file was removed. */
export async function remove(key) {
  try {
    await unlink(getPath(key))
    return true
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return false
  }
}

/** Free bytes on the volume that holds the videos (FR-004a). */
export async function freeBytes() {
  await mkdir(config.VIDEOS_DIR, { recursive: true })
  const stats = await statfs(config.VIDEOS_DIR)
  return stats.bavail * stats.bsize
}
