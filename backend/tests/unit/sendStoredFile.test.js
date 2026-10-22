import { describe, expect, it, vi } from 'vitest'
import { sendStoredFile } from '../../src/lib/sendStoredFile.js'
import * as videoStorage from '../../src/lib/videoStorage.js'

function fakeResponse() {
  const headers = {}
  return {
    headers,
    set: vi.fn((name, value) => {
      headers[name] = value
    }),
    status: vi.fn(function status() {
      return this
    }),
    end: vi.fn(),
    sendFile: vi.fn(),
  }
}

const options = { contentType: 'image/jpeg', cacheControl: 'private, max-age=3600' }

describe('sendStoredFile', () => {
  it('in production only sets X-Accel-Redirect and headers; nginx sends the bytes', () => {
    const { thumbnailStorageKey } = videoStorage.newVideoKeys(4)
    const res = fakeResponse()

    sendStoredFile(res, thumbnailStorageKey, { ...options, useAccelRedirect: true })

    expect(res.headers).toEqual({
      'X-Accel-Redirect': `/internal/videos/${thumbnailStorageKey}`,
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    })
    expect(res.end).toHaveBeenCalledWith()
    expect(res.sendFile).not.toHaveBeenCalled()
  })

  it('without nginx sends the file itself from the storage path', () => {
    const { thumbnailStorageKey } = videoStorage.newVideoKeys(4)
    const res = fakeResponse()

    sendStoredFile(res, thumbnailStorageKey, { ...options, useAccelRedirect: false })

    expect(res.sendFile).toHaveBeenCalledWith(videoStorage.getPath(thumbnailStorageKey), expect.any(Function))
    expect(res.headers['X-Accel-Redirect']).toBeUndefined()
    expect(res.headers['Content-Type']).toBe('image/jpeg')
  })
})
