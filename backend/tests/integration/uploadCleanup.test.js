import { existsSync } from 'node:fs'
import { utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { runUploadCleanup } from '../../src/jobs/uploadCleanup.js'
import { incomingDir } from '../../src/lib/videoStorage.js'
import { uploadFilePath } from '../../src/modules/videos/tusServer.js'
import { agentWithSession, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'
import { createUpload, readFixture, sendChunks } from '../helpers/tus.js'

let agent

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000)

async function partialUpload() {
  const buffer = await readFixture('valid-512x256.mp4')
  const { url } = await createUpload(agent, { size: buffer.length })
  await sendChunks(agent, url, buffer, { until: 2048 })
  return url.split('/').pop()
}

async function age(file, hours) {
  await utimes(file, hoursAgo(hours), hoursAgo(hours))
}

beforeEach(async () => {
  await resetDatabase()
  const a = await createOrganisationRow()
  ;({ agent } = await agentWithSession({ organisationId: a.id }))
})

describe('upload cleanup (FR-011)', () => {
  it('removes an upload whose last chunk is older than the expiry, data and info', async () => {
    const id = await partialUpload()
    await age(uploadFilePath(id), 25)

    await runUploadCleanup()

    expect(existsSync(uploadFilePath(id))).toBe(false)
    expect(existsSync(`${uploadFilePath(id)}.json`)).toBe(false)
  })

  it('keeps a recent upload, even when its info file is old', async () => {
    const id = await partialUpload()
    await age(`${uploadFilePath(id)}.json`, 30)
    await age(uploadFilePath(id), 1)

    await runUploadCleanup()

    expect(existsSync(uploadFilePath(id))).toBe(true)
    expect(existsSync(`${uploadFilePath(id)}.json`)).toBe(true)
  })

  it('removes an old info file without data and an old leftover thumbnail', async () => {
    const orphan = path.join(incomingDir(), '0123456789abcdef0123456789abcdef.json')
    const leftover = path.join(incomingDir(), 'fedcba9876543210fedcba9876543210.thumb.jpg')
    await partialUpload()
    await writeFile(orphan, '{}')
    await writeFile(leftover, 'x')
    await age(orphan, 25)
    await age(leftover, 25)

    await runUploadCleanup()

    expect(existsSync(orphan)).toBe(false)
    expect(existsSync(leftover)).toBe(false)
  })

  it('does nothing when there is no incoming directory', async () => {
    await resetDatabase()
    await expect(runUploadCleanup()).resolves.toBe(0)
  })
})
