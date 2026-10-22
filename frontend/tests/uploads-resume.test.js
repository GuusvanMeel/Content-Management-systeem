import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onUnauthorized } from '../src/api/client'
import UploadIndicator from '../src/components/UploadIndicator.vue'
import { useUploads } from '../src/stores/uploads'
import { FakeUpload, fakeFile, instances, resetInstances, tusError } from './tusMock'

vi.mock('tus-js-client', async () => (await import('./tusMock')).tusModule())
vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())

let pinia
beforeEach(() => {
  resetInstances()
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// The indicator is a small round button by default; open it to read the lines.
async function mountIndicator() {
  const wrapper = mount(UploadIndicator, { global: { plugins: [pinia] } })
  await wrapper.find('[data-test="circle"]').trigger('click')
  return wrapper
}

describe('resuming in the browser (FR-007, FR-009)', () => {
  it('continues a previous upload of the same file and shows "Hervat"', async () => {
    const store = useUploads()
    const previous = [{ uploadUrl: '/api/organisation/video-uploads/abc' }]
    vi.spyOn(FakeUpload.prototype, 'findPreviousUploads').mockResolvedValue(previous)

    await store.addFiles([fakeFile('a.mp4', 100)])
    await flushPromises()

    expect(instances[0].resumedFrom).toBe(previous[0])
    expect(instances[0].started).toBe(true)
    expect(store.items[0].resumed).toBe(true)

    instances[0].options.onProgress(40, 100)
    const wrapper = await mountIndicator()
    expect(wrapper.text()).toContain('Hervat')
    expect(wrapper.text()).toContain('40%')
  })

  it('starts fresh when there is no previous upload', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4')])
    await flushPromises()
    expect(instances[0].resumedFrom).toBeNull()
    expect(store.items[0].resumed).toBe(false)
  })
})

describe('interruptions', () => {
  it('shows "Verbinding verbroken, opnieuw proberen…" while retrying', async () => {
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4')])
    await flushPromises()
    expect(instances[0].options.onShouldRetry(tusError(0))).toBe(true)
    expect(store.items[0].state).toBe('retrying')
    expect((await mountIndicator()).text()).toContain('Verbinding verbroken, opnieuw proberen…')
  })

  it('stops on an expired session, explains how to continue and reports the 401', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)
    const store = useUploads()
    await store.addFiles([fakeFile('a.mp4')])
    await flushPromises()

    instances[0].options.onError(
      tusError(401, { error: { code: 'session_expired', message: 'Je sessie is verlopen. Log opnieuw in.' } }),
    )
    await flushPromises()

    expect(store.items[0].state).toBe('expired')
    expect((await mountIndicator()).text()).toContain(
      'Upload onderbroken. Log opnieuw in en kies hetzelfde bestand om verder te gaan.',
    )
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ status: 401, code: 'session_expired' }))
  })
})
