import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UploadRejectedDialog from '../src/components/UploadRejectedDialog.vue'
import { useUploads } from '../src/stores/uploads'
import { fakeFile, instances, resetInstances, tusError } from './tusMock'

vi.mock('tus-js-client', async () => (await import('./tusMock')).tusModule())
vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())

let pinia
beforeEach(() => {
  resetInstances()
  pinia = createPinia()
  setActivePinia(pinia)
})

const mountDialog = () => mount(UploadRejectedDialog, { global: { plugins: [pinia], stubs: { Teleport: true } } })

async function startUpload(name = 'duik.mp4') {
  const store = useUploads()
  await store.addFiles([fakeFile(name)])
  await flushPromises()
  return store
}

describe('centred message for server rejections (FR-014)', () => {
  it('shows the file name and the message of the server, and closes on OK', async () => {
    const store = await startUpload()
    const message = 'Dit bestand kan niet als video worden geopend. Controleer of de video op je computer goed afspeelt en probeer het opnieuw.'
    instances[0].options.onError(tusError(422, { error: { code: 'video_unreadable', message } }))
    await flushPromises()

    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('Video niet toegevoegd')
    expect(wrapper.text()).toContain('duik.mp4')
    expect(wrapper.text()).toContain(message)

    await wrapper.findAll('button').find((b) => b.text() === 'OK').trigger('click')
    expect(store.rejections).toEqual([])
    expect(wrapper.text()).toBe('')
  })

  it('also shows a "not enough space" refusal (507)', async () => {
    await startUpload()
    instances[0].options.onError(tusError(507, { error: { code: 'insufficient_storage', message: 'Er is op dit moment niet genoeg opslagruimte. Neem contact op met de beheerder.' } }))
    await flushPromises()
    expect(mountDialog().text()).toContain('niet genoeg opslagruimte')
  })

  it('does not show for an expired session or a network failure', async () => {
    const store = await startUpload('a.mp4')
    instances[0].options.onError(tusError(401, { error: { code: 'session_expired', message: 'Je sessie is verlopen.' } }))
    await store.addFiles([fakeFile('b.mp4')])
    await flushPromises()
    instances[1].options.onError(tusError(0))
    await flushPromises()
    expect(store.rejections).toEqual([])
    expect(mountDialog().text()).toBe('')
  })
})
