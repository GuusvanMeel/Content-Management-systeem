import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import UploadIndicator from '../src/components/UploadIndicator.vue'
import { useUploads } from '../src/stores/uploads'
import { fakeFile, instances, resetInstances, successPayload, tusError } from './tusMock'

vi.mock('tus-js-client', async () => (await import('./tusMock')).tusModule())
vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())

let pinia
beforeEach(() => {
  resetInstances()
  pinia = createPinia()
  setActivePinia(pinia)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mountAt(path) {
  const Blank = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/videos', component: Blank }, { path: '/settings/style', component: Blank }],
  })
  await router.push(path)
  return mount(UploadIndicator, { global: { plugins: [pinia, router] } })
}

async function startUpload(name = 'a.mp4') {
  const store = useUploads()
  await store.addFiles([fakeFile(name, 100)])
  await flushPromises()
  return store
}

const panel = (wrapper) => wrapper.find('[data-test="panel"]')
const circle = (wrapper) => wrapper.find('[data-test="circle"]')
const rejection = () => tusError(422, { error: { code: 'video_not_360', message: 'Dit is geen 360°-video.' } })

describe('visibility (FR-006a)', () => {
  it('is always visible on the video page, also without uploads', async () => {
    const wrapper = await mountAt('/videos')
    expect(circle(wrapper).exists()).toBe(true)
    expect(panel(wrapper).exists()).toBe(false)
  })

  it('is only visible on other pages while uploads are listed', async () => {
    const wrapper = await mountAt('/settings/style')
    expect(circle(wrapper).exists()).toBe(false)
    await startUpload()
    expect(circle(wrapper).exists()).toBe(true)
  })
})

describe('collapsed while uploading (FR-006a)', () => {
  it('stays a round button when an upload starts and while it progresses', async () => {
    const wrapper = await mountAt('/videos')
    await startUpload()
    for (const sent of [10, 20, 50, 90]) instances[0].options.onProgress(sent, 100)
    await flushPromises()
    expect(panel(wrapper).exists()).toBe(false)
  })

  it('shows the progress in the ring', async () => {
    const wrapper = await mountAt('/videos')
    await startUpload()
    instances[0].options.onProgress(40, 100)
    await flushPromises()
    expect(circle(wrapper).attributes('style')).toContain('--progress: 40%')
  })
})

describe('opens by itself for events to notice, then collapses after 4 s', () => {
  it.each([
    ['the upload finished', () => instances[0].options.onSuccess(successPayload({ id: 1 })), 'Toegevoegd aan de bibliotheek'],
    ['a rejection', () => instances[0].options.onError(rejection()), 'Dit is geen 360°-video.'],
    ['a lost connection', () => instances[0].options.onShouldRetry(tusError(0)), 'Verbinding verbroken, opnieuw proberen…'],
  ])('on the video page: %s', async (_event, trigger, text) => {
    vi.useFakeTimers()
    const wrapper = await mountAt('/videos')
    await startUpload()
    trigger()
    await flushPromises()
    expect(panel(wrapper).text()).toContain(text)

    vi.advanceTimersByTime(3900)
    await flushPromises()
    expect(panel(wrapper).exists()).toBe(true)
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(panel(wrapper).exists()).toBe(false)
  })

  it('does not open by itself on other pages', async () => {
    const wrapper = await mountAt('/settings/style')
    await startUpload()
    instances[0].options.onShouldRetry(tusError(0))
    instances[0].options.onError(rejection())
    await flushPromises()
    expect(panel(wrapper).exists()).toBe(false)
  })
})

describe('clicking the round button', () => {
  it('opens the file picker of the video page when no uploads are listed', async () => {
    const wrapper = await mountAt('/videos')
    const picker = vi.fn()
    useUploads().registerFilePicker(picker)
    await circle(wrapper).trigger('click')
    expect(picker).toHaveBeenCalledTimes(1)
    expect(circle(wrapper).attributes('aria-label')).toBe('Video toevoegen')
  })

  it('opens and closes the list while uploads are listed, without opening the file picker', async () => {
    const wrapper = await mountAt('/settings/style')
    const picker = vi.fn()
    useUploads().registerFilePicker(picker)
    await startUpload()
    await circle(wrapper).trigger('click')
    expect(panel(wrapper).text()).toContain('Uploaden: 1 bezig, 0 wachtend')
    await circle(wrapper).trigger('click')
    expect(panel(wrapper).exists()).toBe(false)
    expect(picker).not.toHaveBeenCalled()
  })

  it('keeps a list opened by a click open, also after news', async () => {
    vi.useFakeTimers()
    const wrapper = await mountAt('/videos')
    await startUpload()
    await circle(wrapper).trigger('click')
    instances[0].options.onShouldRetry(tusError(0))
    vi.advanceTimersByTime(10_000)
    await flushPromises()
    expect(panel(wrapper).exists()).toBe(true)
  })
})

describe('drop animation when an upload starts (FR-006d)', () => {
  it('drops a file icon into the button and removes it afterwards', async () => {
    vi.useFakeTimers()
    const wrapper = await mountAt('/videos')
    await startUpload()
    expect(wrapper.find('[data-test="drop"]').exists()).toBe(true)
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(wrapper.find('[data-test="drop"]').exists()).toBe(false)
  })

  it('plays no animation with prefers-reduced-motion', async () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('reduce'), media: query }))
    const wrapper = await mountAt('/videos')
    await startUpload()
    expect(wrapper.find('[data-test="drop"]').exists()).toBe(false)
  })
})
