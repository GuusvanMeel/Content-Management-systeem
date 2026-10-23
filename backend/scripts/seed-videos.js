// Creates test videos for one organisation, to check that a large library stays fast (SC-006):
//   docker compose exec -e NODE_ENV=development api node scripts/seed-videos.js <loginCode> <count> [public|private]
// Development only: refuses to run with NODE_ENV=production. The rows point to placeholder files.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../src/config/env.js'
import { db } from '../src/db/knex.js'
import * as videoStorage from '../src/lib/videoStorage.js'

// 64x32 grey JPEG used as thumbnail for every seeded video.
const PLACEHOLDER_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjI4LjEwMgD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABMAAEBAAAAAAAAAAAAAAAAAAAABgEBAQAAAAAAAAAAAAAAAAAAAAQQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAgAEADASIAAhEAAxEA/9oADAMBAAIRAxEAPwCnAWJQAAAAAAAAAAAAAH//2Q==',
  'base64',
)

async function writeStored(key, bytes) {
  const file = videoStorage.getPath(key)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, bytes)
}

/** Inserts `count` videos for the organisation with `loginCode`. Returns the organisation id. */
export async function seedVideos(loginCode, count, visibility = 'private') {
  if (config.NODE_ENV === 'production') throw new Error('seed-videos must not run in production')
  const organisation = await db('Organisation')
    .where({ loginCode: String(loginCode).trim().toUpperCase() })
    .whereNull('deletedAt')
    .first()
  if (!organisation) throw new Error(`No active organisation with code ${loginCode}`)

  const rows = []
  for (let i = 1; i <= count; i++) {
    const keys = videoStorage.newVideoKeys(organisation.id)
    await writeStored(keys.thumbnailStorageKey, PLACEHOLDER_JPEG)
    await writeStored(keys.storageKey, Buffer.from('placeholder'))
    rows.push({
      ownerOrganisationId: organisation.id,
      name: `Testvideo ${i}`,
      description: null,
      ...keys,
      fileSizeBytes: 1024 ** 3 + i * 1024 ** 2,
      durationSeconds: 60 + i,
      visibility,
      uploadedAt: new Date(Date.now() - i * 60 * 1000),
    })
  }
  for (let i = 0; i < rows.length; i += 100) await db('Video').insert(rows.slice(i, i + 100))
  return organisation.id
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [loginCode, rawCount = '200', visibility = 'private'] = process.argv.slice(2)
  const count = Number(rawCount)
  // 'selective' would need chosen organisations, so only public and private are offered (specs/003).
  if (!loginCode || !Number.isInteger(count) || count <= 0 || !['public', 'private'].includes(visibility)) {
    console.error('Usage: node scripts/seed-videos.js <loginCode> <count> [public|private]')
    process.exit(1)
  }
  try {
    await seedVideos(loginCode, count, visibility)
    console.log(`Created ${count} ${visibility} test videos for ${loginCode}.`)
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  } finally {
    await db.destroy()
  }
}
