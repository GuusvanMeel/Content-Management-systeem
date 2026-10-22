import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { config } from '../../src/config/env.js'
import * as storage from '../../src/lib/videoStorage.js'

afterEach(async () => {
  await rm(config.VIDEOS_DIR, { recursive: true, force: true })
})

describe('videoStorage', () => {
  it('moves a file into storage under its key', async () => {
    const { storageKey } = storage.newVideoKeys(7)
    await mkdir(storage.incomingDir(), { recursive: true })
    const source = path.join(storage.incomingDir(), 'upload')
    await writeFile(source, 'video')

    await storage.save(storageKey, source)

    expect(existsSync(source)).toBe(false)
    expect(existsSync(path.join(config.VIDEOS_DIR, ...storageKey.split('/')))).toBe(true)
    expect(storage.getPath(storageKey)).toBe(path.join(config.VIDEOS_DIR, ...storageKey.split('/')))
  })

  it('does not fail when removing a file that does not exist', async () => {
    const { thumbnailStorageKey } = storage.newVideoKeys(7)
    await expect(storage.remove(thumbnailStorageKey)).resolves.toBeUndefined()
  })

  it('creates keys in the documented format', () => {
    const keys = storage.newVideoKeys(12)
    expect(keys.storageKey).toMatch(/^videos\/12\/[0-9a-f-]{36}\.mp4$/)
    expect(keys.thumbnailStorageKey).toMatch(/^thumbnails\/12\/[0-9a-f-]{36}\.jpg$/)
    expect(keys.storageKey.slice(10, 46)).toBe(keys.thumbnailStorageKey.slice(14, 50))
  })

  it.each([
    '../etc/passwd',
    '/data/videos/videos/1/x.mp4',
    'videos/1/../../x.mp4',
    'logos/1/3f1c2d4e-0000-4000-8000-000000000000.png',
    'videos/abc/3f1c2d4e-0000-4000-8000-000000000000.mp4',
  ])('rejects the key %s', (key) => {
    expect(() => storage.getPath(key)).toThrow()
    expect(() => storage.getInternalUrl(key)).toThrow()
  })

  it('maps a key to the internal nginx location', () => {
    const { thumbnailStorageKey } = storage.newVideoKeys(3)
    expect(storage.getInternalUrl(thumbnailStorageKey)).toBe(`/internal/videos/${thumbnailStorageKey}`)
  })

  it('reports free space as a positive number', async () => {
    expect(await storage.freeBytes()).toBeGreaterThan(0)
  })
})
