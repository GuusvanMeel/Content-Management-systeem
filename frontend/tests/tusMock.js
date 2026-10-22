import { vi } from 'vitest'

// A controllable stand-in for tus-js-client's Upload. Tests drive the callbacks by hand.
export const instances = []

export class FakeUpload {
  constructor(file, options) {
    this.file = file
    this.options = options
    this.started = false
    this.aborted = null
    this.previous = []
    this.resumedFrom = null
    instances.push(this)
  }
  findPreviousUploads() {
    return Promise.resolve(this.previous)
  }
  resumeFromPreviousUpload(previous) {
    this.resumedFrom = previous
  }
  start() {
    this.started = true
  }
  abort(shouldTerminate) {
    this.aborted = { shouldTerminate }
    return Promise.resolve()
  }
}

/** A tus error with a response, like tus-js-client's DetailedError. */
export function tusError(status, body) {
  const error = new Error('tus error')
  error.originalResponse = { getStatus: () => status, getBody: () => (body ? JSON.stringify(body) : '') }
  return error
}

export function successPayload(video) {
  return { lastResponse: { getStatus: () => 200, getBody: () => JSON.stringify({ video }) } }
}

export const SETTINGS = {
  maxFileSizeBytes: 10 * 1024 ** 3,
  maxParallelUploads: 1,
  chunkSizeBytes: 32 * 1024 * 1024,
  acceptedExtensions: ['.mp4'],
  uploadEndpoint: '/api/organisation/video-uploads',
}

/** A File-like object with an arbitrary size (no real bytes needed). */
export function fakeFile(name, size = 1000) {
  const file = new File(['x'], name, { type: name.endsWith('.mp4') ? 'video/mp4' : '' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

export function resetInstances() {
  instances.length = 0
}

export const tusModule = () => ({ Upload: FakeUpload })
export const videosModule = () => ({
  getUploadSettings: vi.fn(async () => ({ ...SETTINGS })),
  listVideos: vi.fn(async () => []),
  deleteVideo: vi.fn(async () => null),
})
