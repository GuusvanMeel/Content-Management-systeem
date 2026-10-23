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
  maxWidth: 5760,
  maxHeight: 2880,
  maxParallelUploads: 1,
  chunkSizeBytes: 32 * 1024 * 1024,
  acceptedExtensions: ['.mp4'],
  uploadEndpoint: '/api/organisation/video-uploads',
  defaultVisibility: 'private',
  descriptionMaxLength: 1000,
}

export const ORGANISATIONS = [
  { id: 4, name: 'Brandweer Academie Noord' },
  { id: 9, name: 'Zwembad B' },
]

/** A File-like object with an arbitrary size (no real bytes needed). */
export function fakeFile(name, size = 1000) {
  const file = new File(['x'], name, { type: name.endsWith('.mp4') ? 'video/mp4' : '' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

export function resetInstances() {
  instances.length = 0
  storedUploads.length = 0
  urlStorage.findAllUploads.mockClear()
  urlStorage.removeUpload.mockClear()
  FakeUpload.terminate.mockClear()
}

// tus-js-client's own record of started uploads (research R14), as an in-memory list.
export const storedUploads = []
export const urlStorage = {
  findAllUploads: vi.fn(async () => [...storedUploads]),
  removeUpload: vi.fn(async (key) => {
    const index = storedUploads.findIndex((u) => u.urlStorageKey === key)
    if (index >= 0) storedUploads.splice(index, 1)
  }),
}
FakeUpload.terminate = vi.fn(async () => {})

export const tusModule = () => ({ Upload: FakeUpload, defaultOptions: { urlStorage } })
export const videosModule = () => ({
  getUploadSettings: vi.fn(async () => ({ ...SETTINGS })),
  listVideos: vi.fn(async () => []),
  deleteVideo: vi.fn(async () => null),
  getVideo: vi.fn(async () => null),
  updateVideo: vi.fn(async () => null),
  listOtherOrganisations: vi.fn(async () => [...ORGANISATIONS]),
})
