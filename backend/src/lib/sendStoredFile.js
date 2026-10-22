import { config } from '../config/env.js'
import { getInternalUrl, getPath } from './videoStorage.js'

/**
 * Delivers a stored file after the caller has checked access (specs/002 research R8). In
 * production the API only sets X-Accel-Redirect and nginx sends the bytes (constitution III).
 * Without nginx (development and tests) the API sends the file itself; that branch is the
 * exception recorded in specs/002 plan.md (Complexity Tracking).
 */
export function sendStoredFile(res, key, { contentType, cacheControl, useAccelRedirect = config.NODE_ENV === 'production' }) {
  res.set('Content-Type', contentType)
  res.set('Cache-Control', cacheControl)
  if (useAccelRedirect) {
    res.set('X-Accel-Redirect', getInternalUrl(key))
    res.status(200).end()
    return
  }
  return new Promise((resolve, reject) => {
    res.sendFile(getPath(key), (err) => (err ? reject(err) : resolve()))
  })
}
