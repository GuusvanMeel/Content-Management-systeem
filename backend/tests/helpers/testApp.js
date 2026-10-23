import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { config } from '../../src/config/env.js'
import { db } from '../../src/db/knex.js'
import { generateQuestLinkCode } from '../../src/lib/codes.js'
import { hashPassword } from '../../src/lib/password.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import { createSession } from '../../src/modules/auth/sessionRepository.js'
import { JPG_BYTES } from './images.js'

export const app = createApp()

/** Empties all tables (children first), the uploads directory and the videos directory. */
export async function resetDatabase() {
  for (const table of ['VideoAccess', 'Video', 'AdminActionLog', 'OrganisationStyle', 'Session', 'Organisation', 'Administrator']) {
    await db(table).del()
  }
  await rm(config.UPLOADS_DIR, { recursive: true, force: true })
  await rm(config.VIDEOS_DIR, { recursive: true, force: true })
}

/**
 * Inserts a verified video directly (without an upload), with a small JPEG thumbnail and a
 * placeholder video file on disk. `uploadedAt` can be set to control the order;
 * `accessOrganisationIds` writes VideoAccess rows (for visibility 'selective').
 */
export async function createVideoRow({
  organisationId,
  name = 'Testvideo',
  description = null,
  visibility = 'private',
  accessOrganisationIds = [],
  durationSeconds = 95,
  fileSizeBytes = 3221225472,
  uploadedAt = new Date(),
  deletedAt = null,
} = {}) {
  const keys = videoStorage.newVideoKeys(organisationId)
  for (const [key, bytes] of [[keys.storageKey, Buffer.from('video')], [keys.thumbnailStorageKey, JPG_BYTES]]) {
    const file = videoStorage.getPath(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, bytes)
  }
  const [id] = await db('Video').insert({
    ownerOrganisationId: organisationId,
    name,
    description,
    ...keys,
    fileSizeBytes,
    durationSeconds,
    visibility,
    uploadedAt,
    deletedAt,
  })
  if (accessOrganisationIds.length > 0) {
    await db('VideoAccess').insert(accessOrganisationIds.map((accessId) => ({ videoId: id, organisationId: accessId })))
  }
  return { id, name, ...keys }
}

export async function createAdmin(username = 'beheer', password = 'admin-password-123') {
  const [id] = await db('Administrator').insert({ username, passwordHash: await hashPassword(password) })
  return { id, username, password }
}

export async function createOrganisationRow({
  name = 'Zwembad De Hoven',
  loginCode = 'ZWEMBAD-DE-HOVEN',
  password = 'organisation-password-1',
  questLinkCode = generateQuestLinkCode(),
  deletedAt = null,
} = {}) {
  const [id] = await db('Organisation').insert({
    name,
    loginCode,
    passwordHash: await hashPassword(password),
    questLinkCode,
    deletedAt,
  })
  return { id, name, loginCode, password, questLinkCode }
}

/** A Supertest agent that sends the CSRF header on every request. Cookies are kept between requests. */
export function newAgent() {
  return request.agent(app).set('X-Requested-With', 'cms')
}

/**
 * Creates a session directly (without a login route) and returns a client that sends its cookie.
 * `token` can be passed to setLastActivity.
 */
export async function agentWithSession({ administratorId, organisationId }) {
  const token = await createSession({ administratorId, organisationId })
  const agent = request.agent(app).set('X-Requested-With', 'cms').set('Cookie', `sid=${token}`)
  return { agent, token }
}

export function sessionRowByToken(token) {
  return db('Session')
    .where({ tokenHash: db.raw('SHA2(?, 256)', [token]) })
    .first()
}

/** Moves lastActivityAt of a session `minutesAgo` minutes into the past. */
export function setLastActivity(token, minutesAgo) {
  return db('Session')
    .where({ tokenHash: db.raw('SHA2(?, 256)', [token]) })
    .update({ lastActivityAt: db.raw('UTC_TIMESTAMP() - INTERVAL ? MINUTE', [minutesAgo]) })
}

/** The Set-Cookie header for `sid`, or undefined. */
export function sidCookie(response) {
  return (response.headers['set-cookie'] ?? []).find((cookie) => cookie.startsWith('sid='))
}
