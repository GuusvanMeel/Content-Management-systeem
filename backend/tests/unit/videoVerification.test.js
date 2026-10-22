import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { videoMessage } from '../../src/lib/videoMessages.js'
import { makeThumbnail, probeVideo } from '../../src/lib/videoVerification.js'
import { FIXTURES_DIR } from '../helpers/tus.js'

const run = promisify(execFile)
const fixture = (name) => path.join(FIXTURES_DIR, name)

let tmp
beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'verify-'))
})
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe('probeVideo', () => {
  it.each([
    ['valid-512x256.mp4', 512, 256],
    ['valid-silent-1024x512.mp4', 1024, 512],
    ['valid-opus-audio-512x256.mp4', 512, 256],
    ['valid-max-5760x2880.mp4', 5760, 2880],
  ])('accepts %s', async (name, width, height) => {
    expect(await probeVideo(fixture(name))).toEqual({ durationSeconds: 2, width, height })
  })

  it.each([
    ['not-360-640x360.mp4', 'video_not_360'],
    ['square-1024x1024.mp4', 'video_not_360'],
    ['too-large-6144x3072.mp4', 'video_resolution_too_high'],
    ['h265-512x256.mp4', 'video_unsupported_codec'],
    ['quicktime-512x256.mp4', 'video_unsupported_format'],
    ['audio-only.mp4', 'video_unreadable'],
    ['corrupt.mp4', 'video_unreadable'],
  ])('rejects %s with %s', async (name, code) => {
    await expect(probeVideo(fixture(name))).rejects.toMatchObject({ code, status: 422 })
  })

  it('uses the plain-language messages from videoMessages.js', async () => {
    await expect(probeVideo(fixture('not-360-640x360.mp4'))).rejects.toMatchObject({
      message: videoMessage('video_not_360'),
    })
    await expect(probeVideo(fixture('too-large-6144x3072.mp4'))).rejects.toMatchObject({
      message: videoMessage('video_resolution_too_high'),
    })
  })
})

describe('makeThumbnail', () => {
  it('creates a 1024x512 JPEG', async () => {
    const dest = path.join(tmp, 'thumb.jpg')
    await makeThumbnail(fixture('valid-512x256.mp4'), dest, 2)
    const { stdout } = await run('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-of', 'csv=p=0', dest,
    ])
    expect(stdout.trim()).toBe('mjpeg,1024,512')
  })

  it('probes and creates a thumbnail for the largest fixture within 20 s (FR-015)', async () => {
    const start = Date.now()
    const { durationSeconds } = await probeVideo(fixture('valid-max-5760x2880.mp4'))
    await makeThumbnail(fixture('valid-max-5760x2880.mp4'), path.join(tmp, 'big.jpg'), durationSeconds)
    expect(Date.now() - start).toBeLessThan(20000)
  })
})
