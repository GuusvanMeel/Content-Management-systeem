import { readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/env.js'
import { incomingDir } from '../lib/videoStorage.js'

const INTERVAL_MS = 15 * 60 * 1000

// tus keeps "<id>" (data, touched by every chunk) and "<id>.json" (info, written once) per
// upload; finalisation can leave "<id>.thumb.jpg". The age of an upload is the age of its data
// file; files without a data file count on their own age (specs/002 research R9).
const groupKey = (name) => name.replace(/\.json$/, '')

async function mtime(file) {
  try {
    return (await stat(file)).mtimeMs
  } catch {
    return null
  }
}

/** Removes incomplete uploads without a new chunk for UPLOAD_EXPIRY_HOURS. Returns the number of files removed. */
export async function runUploadCleanup() {
  const dir = incomingDir()
  let names
  try {
    names = await readdir(dir)
  } catch (err) {
    if (err.code === 'ENOENT') return 0
    throw err
  }

  const cutoff = Date.now() - config.UPLOAD_EXPIRY_HOURS * 60 * 60 * 1000
  const groups = new Map()
  for (const name of names) {
    const key = groupKey(name)
    groups.set(key, [...(groups.get(key) ?? []), name])
  }

  let removed = 0
  for (const [key, members] of groups) {
    const dataAge = members.includes(key) ? await mtime(path.join(dir, key)) : null
    for (const name of members) {
      const age = dataAge ?? (await mtime(path.join(dir, name)))
      if (age === null || age >= cutoff) continue
      try {
        await unlink(path.join(dir, name))
        removed++
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
    }
  }
  console.log(`upload cleanup: removed ${removed} files of incomplete uploads`)
  return removed
}

/** Runs the cleanup now and then every 15 minutes (FR-011). Returns a function that stops it. */
export function startUploadCleanup() {
  const run = () => runUploadCleanup().catch((err) => console.error('upload cleanup failed:', err))
  run()
  const timer = setInterval(run, INTERVAL_MS)
  timer.unref()
  return () => clearInterval(timer)
}
