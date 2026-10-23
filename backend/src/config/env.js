import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

// Outside Docker the repository's .env is read; variables that are already set always win.
const envFile = path.join(repoRoot, '.env')
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const env = process.env
const NODE_ENV = env.NODE_ENV || 'development'

const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'API_PORT', 'UPLOADS_DIR', 'VIDEOS_DIR']
if (NODE_ENV === 'test') required.push('TEST_DB_NAME')

const missing = required.filter((key) => !env[key])
if (missing.length > 0) {
  throw new Error(
    `Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`,
  )
}

function positiveInteger(key, fallback) {
  const raw = env[key]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer, got "${raw}".`)
  }
  return value
}

// 1 GB = 1024^3 bytes, for both limits and display (specs/002 research R5).
const GIB = 1024 ** 3
const videoMaxSizeGb = positiveInteger('VIDEO_MAX_SIZE_GB', 10)
const videoMinFreeSpaceGb = positiveInteger('VIDEO_MIN_FREE_SPACE_GB', 20)

// Pre-selected availability in the upload dialog (specs/003 research R3). A typo must not stop the
// API, so an invalid value falls back to the safest choice with a warning.
const VISIBILITIES = ['public', 'selective', 'private']
function defaultVisibility() {
  const raw = env.VIDEO_DEFAULT_VISIBILITY
  if (raw === undefined || raw === '') return 'private'
  if (VISIBILITIES.includes(raw)) return raw
  console.warn(`VIDEO_DEFAULT_VISIBILITY "${raw}" is invalid; using private`)
  return 'private'
}

export const config = Object.freeze({
  NODE_ENV,
  DB_HOST: env.DB_HOST,
  DB_PORT: positiveInteger('DB_PORT'),
  DB_NAME: env.DB_NAME,
  DB_USER: env.DB_USER,
  DB_PASSWORD: env.DB_PASSWORD,
  TEST_DB_NAME: env.TEST_DB_NAME,
  API_PORT: positiveInteger('API_PORT'),
  UPLOADS_DIR: path.resolve(repoRoot, env.UPLOADS_DIR),
  COOKIE_SECURE: env.COOKIE_SECURE !== 'false',
  SESSION_IDLE_TIMEOUT_MINUTES: positiveInteger('SESSION_IDLE_TIMEOUT_MINUTES', 60),
  // Video library (specs/002): files live outside UPLOADS_DIR, which is public under /media.
  VIDEOS_DIR: path.resolve(repoRoot, env.VIDEOS_DIR),
  VIDEO_MAX_SIZE_GB: videoMaxSizeGb,
  VIDEO_MAX_SIZE_BYTES: videoMaxSizeGb * GIB,
  VIDEO_MIN_FREE_SPACE_GB: videoMinFreeSpaceGb,
  VIDEO_MIN_FREE_SPACE_BYTES: videoMinFreeSpaceGb * GIB,
  // Enforced only in the browser; the server just reports it (FR-006b).
  VIDEO_MAX_PARALLEL_UPLOADS: positiveInteger('VIDEO_MAX_PARALLEL_UPLOADS', 1),
  VIDEO_CHUNK_SIZE_BYTES: 32 * 1024 * 1024,
  UPLOAD_EXPIRY_HOURS: positiveInteger('UPLOAD_EXPIRY_HOURS', 24),
  // Maximum frame size in pixels; the browser reads the same values (FR-003a).
  VIDEO_MAX_WIDTH: positiveInteger('VIDEO_MAX_WIDTH', 5760),
  VIDEO_MAX_HEIGHT: positiveInteger('VIDEO_MAX_HEIGHT', 2880),
  // Central library (specs/003).
  VIDEO_DEFAULT_VISIBILITY: defaultVisibility(),
  VIDEO_DESCRIPTION_MAX_LENGTH: 1000,
})
