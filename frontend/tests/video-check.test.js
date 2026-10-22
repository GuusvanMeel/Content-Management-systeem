import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkVideo } from '../src/lib/videoCheck'
import { videoMessage } from '../src/lib/videoMessages'

// The same test videos as the backend, so browser and server are tested on the same files.
// Vitest runs from frontend/ (locally and in the web-build image).
const FIXTURES = path.resolve(process.cwd(), '../backend/tests/fixtures/videos')
const SETTINGS = { maxFileSizeBytes: 10 * 1024 ** 3, maxWidth: 5760, maxHeight: 2880 }

async function fixtureFile(name) {
  return new File([await readFile(path.join(FIXTURES, name))], name, { type: 'video/mp4' })
}

describe('checkVideo with the shared test videos', () => {
  it.each([
    ['valid-512x256.mp4', 512, 256],
    ['valid-silent-1024x512.mp4', 1024, 512],
    ['valid-opus-audio-512x256.mp4', 512, 256],
    ['valid-max-5760x2880.mp4', 5760, 2880],
  ])('accepts %s', async (name, width, height) => {
    expect(await checkVideo(await fixtureFile(name), SETTINGS)).toEqual({ status: 'ok', width, height })
  })

  it.each([
    ['not-360-640x360.mp4', 'video_not_360'],
    ['square-1024x1024.mp4', 'video_not_360'],
    ['too-large-6144x3072.mp4', 'video_resolution_too_high'],
    ['h265-512x256.mp4', 'video_unsupported_codec'],
    ['quicktime-512x256.mp4', 'video_unsupported_format'],
    ['audio-only.mp4', 'video_unreadable'],
    ['clip.mov', 'video_unsupported_format'],
  ])('rejects %s with %s, with the same message as the server', async (name, code) => {
    expect(await checkVideo(await fixtureFile(name), SETTINGS)).toEqual({
      status: 'invalid',
      code,
      message: videoMessage(code, SETTINGS),
    })
  })

  it('lets a file through that it cannot read; the server decides (FR-013b)', async () => {
    expect(await checkVideo(await fixtureFile('corrupt.mp4'), SETTINGS)).toEqual({ status: 'unknown' })
  })
})

describe('checkVideo limits from the settings', () => {
  it('refuses a file above the maximum size without reading it', async () => {
    const file = new File(['x'], 'groot.mp4')
    Object.defineProperty(file, 'size', { value: SETTINGS.maxFileSizeBytes + 1 })
    expect(await checkVideo(file, SETTINGS)).toMatchObject({ status: 'invalid', code: 'video_too_large' })
  })

  it('uses the configured maximum resolution', async () => {
    const result = await checkVideo(await fixtureFile('valid-silent-1024x512.mp4'), { ...SETTINGS, maxWidth: 1000, maxHeight: 500 })
    expect(result).toEqual({
      status: 'invalid',
      code: 'video_resolution_too_high',
      message: videoMessage('video_resolution_too_high', { maxWidth: 1000, maxHeight: 500 }),
    })
    expect(result.message).toContain('maximaal 1000 × 500 beeldpunten')
  })

  it('finds the moov box when it is at the end of the file', async () => {
    // quicktime-512x256.mp4 and not-360 were made without +faststart: moov after mdat.
    expect(await checkVideo(await fixtureFile('not-360-640x360.mp4'), SETTINGS)).toMatchObject({ code: 'video_not_360' })
  })
})
