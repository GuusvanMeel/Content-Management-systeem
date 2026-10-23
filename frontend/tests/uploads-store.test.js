import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { videoMessage } from '../src/lib/videoMessages'
import { useUploads } from '../src/stores/uploads'
import { SETTINGS, fakeFile, instances, resetInstances, successPayload, tusError } from './tusMock'

vi.mock('tus-js-client', async () => (await import('./tusMock')).tusModule())
vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())

beforeEach(() => {
  resetInstances()
})

const states = (store) => store.items.map((i) => [i.name, i.state])

describe('uploads store: checks before uploading', () => {
  it('refuses a non-MP4 file without uploading', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('clip.mov')])
    expect(store.items[0]).toMatchObject({ state: 'rejected', message: videoMessage('video_unsupported_format', SETTINGS) })
    expect(instances).toHaveLength(0)
  })

  it('refuses a file above the maximum size without uploading', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('groot.mp4', 10 * 1024 ** 3 + 1)])
    expect(store.items[0]).toMatchObject({ state: 'rejected', message: 'Deze video is groter dan 10 GB. Maak de video korter of sla hem op in een lagere kwaliteit.' })
    expect(instances).toHaveLength(0)
  })

  it('uses the given name for a single file and the file name otherwise', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4')], { name: 'Mijn video' })
    await store.addFiles([fakeFile('b.mp4'), fakeFile('c.MP4')], { name: 'genegeerd' })
    expect(store.items.map((i) => i.name)).toEqual(['Mijn video', 'b', 'c'])
  })

  it('sends the CSRF header and the name as metadata', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4')], { name: 'Mijn video' })
    await flushPromises()
    const { options } = instances[0]
    expect(options.headers).toEqual({ 'X-Requested-With': 'cms' })
    expect(options.metadata).toEqual({ filename: 'a.mp4', name: 'Mijn video' })
    expect(options.chunkSize).toBe(32 * 1024 * 1024)
  })

  it('sends availability and description as metadata (specs/003 research R4)', async () => {
    const store = useUploads()
    await store.addFiles([
      { file: fakeFile('a.mp4'), name: 'A', description: '  Regel 1\nRegel 2 ', visibility: 'selective', accessOrganisationIds: [4, 9] },
      { file: fakeFile('b.mp4'), name: 'B', description: '', visibility: 'public', accessOrganisationIds: [4] },
    ])
    await flushPromises()
    expect(instances[0].options.metadata).toEqual({
      filename: 'a.mp4',
      name: 'A',
      visibility: 'selective',
      description: 'Regel 1\nRegel 2',
      accessOrganisationIds: '4,9',
    })
    instances[0].options.onSuccess(successPayload({ id: 1 }))
    await flushPromises()
    expect(instances[1].options.metadata).toEqual({ filename: 'b.mp4', name: 'B', visibility: 'public' })
  })

  it('shows the field message of a refused choice and does not retry', async () => {
    const store = useUploads()
    await store.addFiles([{ file: fakeFile('a.mp4'), name: 'A', visibility: 'selective', accessOrganisationIds: [4] }])
    await flushPromises()
    const error = tusError(400, {
      error: {
        code: 'validation_failed',
        message: 'Controleer de ingevulde gegevens.',
        fields: { accessOrganisationIds: 'Kies alleen organisaties uit de lijst.' },
      },
    })
    expect(instances[0].options.onShouldRetry(error)).toBe(false)
    instances[0].options.onError(error)
    await flushPromises()
    expect(store.items[0]).toMatchObject({ state: 'rejected', message: 'Kies alleen organisaties uit de lijst.' })
  })
})

describe('uploads store: queue', () => {
  it('runs one upload at a time and starts the next when one finishes', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4'), fakeFile('b.mp4'), fakeFile('c.mp4')])
    await flushPromises()
    expect(states(store)).toEqual([['a', 'uploading'], ['b', 'queued'], ['c', 'queued']])
    expect(instances).toHaveLength(1)

    instances[0].options.onSuccess(successPayload({ id: 1 }))
    await flushPromises()
    expect(states(store)).toEqual([['a', 'done'], ['b', 'uploading'], ['c', 'queued']])
    expect(store.addedCount).toBe(1)
  })

  it('starts the next one when the running upload is rejected', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4'), fakeFile('b.mp4')])
    await flushPromises()
    instances[0].options.onError(tusError(422, { error: { code: 'video_not_360', message: 'Dit is geen 360°-video: …' } }))
    await flushPromises()
    expect(store.items[0]).toMatchObject({ state: 'rejected', message: 'Dit is geen 360°-video: …' })
    expect(store.items[1].state).toBe('uploading')
  })

  it('cancels a running upload with termination and starts the next', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4'), fakeFile('b.mp4')])
    await flushPromises()
    const first = instances[0]
    await store.cancel(store.items[0].id)
    await flushPromises()
    expect(first.aborted).toEqual({ shouldTerminate: true })
    expect(states(store)).toEqual([['b', 'uploading']])
  })

  it('takes a waiting file out of the queue', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4'), fakeFile('b.mp4')])
    await flushPromises()
    await store.cancel(store.items[1].id)
    expect(states(store)).toEqual([['a', 'uploading']])
    expect(instances).toHaveLength(1)
  })

  it('shows "verifying" once all bytes are sent', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4', 100)])
    await flushPromises()
    instances[0].options.onProgress(50, 100)
    expect(store.items[0]).toMatchObject({ state: 'uploading', bytesUploaded: 50 })
    instances[0].options.onProgress(100, 100)
    expect(store.items[0].state).toBe('verifying')
  })

  it('does not retry an answer that will not change (e.g. 507)', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4')])
    await flushPromises()
    expect(instances[0].options.onShouldRetry(tusError(507))).toBe(false)
    expect(instances[0].options.onShouldRetry(tusError(422))).toBe(false)
  })
})

describe('uploads store: leaving the page', () => {
  it('registers beforeunload only while something runs or waits', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4')])
    await flushPromises()
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true)

    instances[0].options.onSuccess(successPayload({ id: 1 }))
    await flushPromises()
    expect(remove.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true)
  })

  it('abortAll stops uploads without terminating them, so they can be resumed', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4'), fakeFile('b.mp4')])
    await flushPromises()
    await store.abortAll()
    expect(instances[0].aborted).toEqual({ shouldTerminate: false })
    expect(store.items).toEqual([])
    expect(store.hasActive).toBe(false)
  })
})
