import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

// Checks an uploaded file with ffprobe and creates the thumbnail with ffmpeg (specs/002
// research R4). Audio is never checked (FR-002a).

const run = promisify(execFile)

// Two 20 s budgets keep verification within the 60 s of FR-015, with room to move the files.
const PROBE_TIMEOUT_MS = 20_000
const THUMBNAIL_TIMEOUT_MS = 20_000
const MAX_WIDTH = 4096
const MAX_HEIGHT = 2048

// Customer-facing messages (contracts/api.md), therefore in Dutch.
const MESSAGES = {
  video_unsupported_format: "Alleen MP4-video's (H.264) worden ondersteund.",
  video_unsupported_codec: "Alleen MP4-video's (H.264) worden ondersteund. Deze video gebruikt een andere codec.",
  video_not_360: 'Dit is geen 360°-video: het beeld moet twee keer zo breed zijn als hoog (2:1).',
  video_resolution_too_high: 'De resolutie is te hoog: een video mag maximaal 4096×2048 pixels zijn.',
  video_unreadable: 'Dit bestand kan niet gelezen worden. Controleer of het een werkende video is.',
}

export class VideoRejectedError extends Error {
  constructor(code) {
    super(MESSAGES[code])
    this.code = code
    this.status = 422
  }
}

async function ffprobe(file) {
  try {
    const { stdout } = await run(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
      { timeout: PROBE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    )
    return JSON.parse(stdout)
  } catch {
    throw new VideoRejectedError('video_unreadable')
  }
}

/** A missing, 0:1 or 1:1 sample aspect ratio means square pixels. */
const squarePixels = (sar) => !sar || sar === '0:1' || sar === '1:1'

/**
 * Checks, in this order: readable with a video stream, MP4 (not QuickTime), H.264, 2:1 and at
 * most 4096x2048. Returns the duration in whole seconds and the frame size.
 */
export async function probeVideo(file) {
  const info = await ffprobe(file)
  const video = info.streams?.find((stream) => stream.codec_type === 'video')
  if (!info.format || !video) throw new VideoRejectedError('video_unreadable')

  // ffprobe reports MOV as "mov,mp4,..." as well; the major brand tells them apart.
  const formatName = info.format.format_name ?? ''
  const brand = (info.format.tags?.major_brand ?? '').trim()
  if (!formatName.split(',').includes('mp4') || brand === 'qt') {
    throw new VideoRejectedError('video_unsupported_format')
  }
  if (video.codec_name !== 'h264') throw new VideoRejectedError('video_unsupported_codec')

  const { width, height } = video
  if (!width || !height || width !== 2 * height || !squarePixels(video.sample_aspect_ratio)) {
    throw new VideoRejectedError('video_not_360')
  }
  if (width > MAX_WIDTH || height > MAX_HEIGHT) throw new VideoRejectedError('video_resolution_too_high')

  const duration = Number(info.format.duration ?? video.duration)
  if (!Number.isFinite(duration) || duration <= 0) throw new VideoRejectedError('video_unreadable')
  return { durationSeconds: Math.round(duration), width, height }
}

/**
 * Writes one 1024x512 JPEG frame to `dest`, taken at 10% of the duration (at least 1 s, but
 * before the end), because the very first frame is often black.
 */
export async function makeThumbnail(src, dest, durationSeconds) {
  const at = Math.min(Math.max(1, durationSeconds * 0.1), Math.max(0, durationSeconds - 0.5))
  try {
    await run(
      'ffmpeg',
      ['-v', 'error', '-y', '-ss', at.toFixed(2), '-i', src, '-frames:v', '1', '-vf', 'scale=1024:512', '-q:v', '4', dest],
      { timeout: THUMBNAIL_TIMEOUT_MS },
    )
  } catch {
    throw new VideoRejectedError('video_unreadable')
  }
}
