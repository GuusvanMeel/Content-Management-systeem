import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResumeNotice from '../src/components/ResumeNotice.vue'
import { useUploads } from '../src/stores/uploads'
import { FakeUpload, fakeFile, instances, resetInstances, storedUploads, urlStorage } from './tusMock'

vi.mock('tus-js-client', async () => (await import('./tusMock')).tusModule())
vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())

let pinia
beforeEach(() => {
  resetInstances()
  pinia = createPinia()
  setActivePinia(pinia)
})

function stored(key, name, url = `/api/organisation/video-uploads/${key}`) {
  storedUploads.push({ urlStorageKey: key, uploadUrl: url, size: 1000, metadata: { filename: `${name}.mp4`, name } })
}

/** HEAD answers per upload URL: [status, offset, length]. */
function serverHas(answers) {
  globalThis.fetch.mockImplementation(async (url, options) => {
    expect(options.method).toBe('HEAD')
    const [status, offset = 0, length = 1000] = answers[url] ?? [404]
    return new Response(null, { status, headers: { 'Upload-Offset': String(offset), 'Upload-Length': String(length) } })
  })
}

const mountNotice = () => mount(ResumeNotice, { global: { plugins: [pinia] } })

describe('notice about interrupted uploads (FR-009a)', () => {
  it('shows the name and the percentage reported by the server', async () => {
    stored('k1', 'Duikplank')
    serverHas({ '/api/organisation/video-uploads/k1': [200, 420, 1000] })
    await useUploads().loadInterrupted()

    const wrapper = mountNotice()
    expect(wrapper.text()).toContain(
      'Je bent eerder begonnen met uploaden van Duikplank, 42% klaar. Kies het bestand opnieuw om verder te gaan, of verwijder het.',
    )
  })

  it('forgets an upload the server no longer has, without showing it', async () => {
    stored('gone', 'Weg')
    serverHas({})
    await useUploads().loadInterrupted()

    expect(mountNotice().text()).toBe('')
    expect(urlStorage.removeUpload).toHaveBeenCalledWith('gone')
  })

  it('"Verwijderen" cancels the upload on the server and forgets it', async () => {
    stored('k1', 'Duikplank')
    serverHas({ '/api/organisation/video-uploads/k1': [200, 100, 1000] })
    await useUploads().loadInterrupted()
    const wrapper = mountNotice()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(FakeUpload.terminate).toHaveBeenCalledWith('/api/organisation/video-uploads/k1', { headers: { 'X-Requested-With': 'cms' } })
    expect(urlStorage.removeUpload).toHaveBeenCalledWith('k1')
    expect(wrapper.text()).toBe('')
  })

  it('disappears when the same file is chosen again and resumes', async () => {
    stored('k1', 'Duikplank')
    serverHas({ '/api/organisation/video-uploads/k1': [200, 100, 1000] })
    const store = useUploads()
    await store.loadInterrupted()
    vi.spyOn(FakeUpload.prototype, 'findPreviousUploads').mockResolvedValue([storedUploads[0]])

    await store.addFiles([fakeFile('Duikplank.mp4')])
    await flushPromises()

    expect(instances[0].resumedFrom).toEqual(storedUploads[0])
    expect(mountNotice().text()).toBe('')
  })

  it('shows nothing when this browser has no interrupted uploads', async () => {
    await useUploads().loadInterrupted()
    expect(mountNotice().text()).toBe('')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
