import { createFile, Log, MP4BoxBuffer } from 'mp4box'
import { videoMessage } from './videoMessages'

// Checks a video in the browser before anything is uploaded (specs/002 research R13), with the
// same rules as the server (research R4). Only the box headers, `ftyp` and `moov` are read, so a
// 10 GB file is checked in well under a second. When the browser cannot read a file, the result
// is "unknown" and the upload is allowed: the server check decides (FR-013b).

const READ_TIMEOUT_MS = 10_000
// moov describes the tracks and is normally a few MB; anything bigger is left to the server.
const MAX_MOOV_BYTES = 64 * 1024 * 1024
const MAX_TOP_LEVEL_BOXES = 10_000

Log.setLogLevel?.(Log.error)

const fourCC = (view, offset) =>
  String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3))

async function read(file, start, end) {
  return file.slice(start, end).arrayBuffer()
}

/** Walks the top-level boxes using only their headers; returns where ftyp and moov are. */
async function findBoxes(file) {
  const found = {}
  let position = 0
  for (let count = 0; position < file.size && count < MAX_TOP_LEVEL_BOXES; count++) {
    const header = new DataView(await read(file, position, Math.min(position + 16, file.size)))
    if (header.byteLength < 8) return null
    let size = header.getUint32(0)
    const type = fourCC(header, 4)
    if (!/^[\x20-\x7e]{4}$/.test(type)) return null
    if (size === 1) {
      if (header.byteLength < 16) return null
      size = Number(header.getBigUint64(8))
    } else if (size === 0) {
      size = file.size - position
    }
    if (size < 8) return null
    if ((type === 'ftyp' || type === 'moov') && !found[type]) found[type] = { start: position, size }
    if (found.ftyp && found.moov) return found
    position += size
  }
  return found
}

/** Parses ftyp + moov with mp4box.js; returns { majorBrand, videoTrack } or null. */
async function parseMovie(file, boxes) {
  if (!boxes?.ftyp || !boxes?.moov || boxes.moov.size > MAX_MOOV_BYTES) return null
  const ftyp = await read(file, boxes.ftyp.start, boxes.ftyp.start + boxes.ftyp.size)
  const moov = await read(file, boxes.moov.start, boxes.moov.start + boxes.moov.size)
  // The two boxes glued together form a small, valid MP4 header; the video data is not needed.
  const joined = new Uint8Array(ftyp.byteLength + moov.byteLength)
  joined.set(new Uint8Array(ftyp), 0)
  joined.set(new Uint8Array(moov), ftyp.byteLength)

  return new Promise((resolve) => {
    const mp4 = createFile()
    let info = null
    mp4.onReady = (movie) => {
      info = movie
    }
    mp4.onError = () => resolve(null)
    try {
      mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(joined.buffer, 0))
      mp4.flush()
    } catch {
      resolve(null)
      return
    }
    if (!info) {
      resolve(null)
      return
    }
    resolve({ majorBrand: (mp4.ftyp?.major_brand ?? '').trim(), videoTrack: info.videoTracks?.[0] ?? null })
  })
}

function withTimeout(promise) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve('timeout'), READ_TIMEOUT_MS))])
}

const invalid = (code, settings) => ({ status: 'invalid', code, message: videoMessage(code, settings) })

/**
 * Returns { status: 'ok', width, height } | { status: 'invalid', code, message } |
 * { status: 'unknown' } for one File. `settings` is the answer of upload-settings.
 */
export async function checkVideo(file, settings) {
  if (!/\.mp4$/i.test(file.name)) return invalid('video_unsupported_format', settings)
  if (file.size > settings.maxFileSizeBytes) return invalid('video_too_large', settings)

  let movie
  try {
    movie = await withTimeout(findBoxes(file).then((boxes) => parseMovie(file, boxes)))
  } catch {
    movie = null
  }
  if (!movie || movie === 'timeout') return { status: 'unknown' }

  if (movie.majorBrand === 'qt') return invalid('video_unsupported_format', settings)
  const track = movie.videoTrack
  if (!track) return invalid('video_unreadable', settings)
  if (!/^avc[13]/.test(track.codec ?? '')) return invalid('video_unsupported_codec', settings)

  const width = track.video?.width ?? track.track_width
  const height = track.video?.height ?? track.track_height
  if (!width || !height || width !== 2 * height) return invalid('video_not_360', settings)
  if (width > settings.maxWidth || height > settings.maxHeight) return invalid('video_resolution_too_high', settings)
  return { status: 'ok', width, height }
}
