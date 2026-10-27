import { db } from '../db/knex.js'
import * as videoStorage from '../lib/videoStorage.js'

const INTERVAL_MS = 15 * 60 * 1000

/**
 * Soft-deleted videos whose files may go (specs/002 FR-020a, research R16): deleted, and not
 * referenced by any course step at all, also not by a step of a soft-deleted course
 * (specs/004 FR-016).
 */
function removableVideos() {
  return db('Video as v')
    .whereNotNull('v.deletedAt')
    .whereNotExists(function referencedByStep() {
      this.select(db.raw('1')).from('CourseStep as s').whereRaw('s.videoId = v.id')
    })
    .select('v.id', 'v.storageKey', 'v.thumbnailStorageKey')
}

/**
 * Removes the video file and thumbnail of every removable video. The row and its foreign keys
 * stay. Nothing records that the files are gone, so every run tries these videos again; a file
 * that is already gone is fine. One failing video is logged and does not stop the others.
 * Returns the number of files actually removed.
 */
export async function runVideoFileCleanup() {
  let removed = 0
  for (const video of await removableVideos()) {
    try {
      if (await videoStorage.remove(video.storageKey)) removed++
      if (video.thumbnailStorageKey && (await videoStorage.remove(video.thumbnailStorageKey))) removed++
    } catch (err) {
      console.error(`video file cleanup failed for video ${video.id}:`, err)
    }
  }
  if (removed > 0) console.log(`video file cleanup: removed ${removed} files of deleted videos`)
  return removed
}

/** Runs the cleanup now and then every 15 minutes, like the upload cleanup. Returns a function that stops it. */
export function startVideoFileCleanup() {
  const run = () => runVideoFileCleanup().catch((err) => console.error('video file cleanup failed:', err))
  run()
  const timer = setInterval(run, INTERVAL_MS)
  timer.unref()
  return () => clearInterval(timer)
}
