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

const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'API_PORT', 'UPLOADS_DIR']
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
})
