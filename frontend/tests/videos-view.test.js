import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteVideo, listVideos } from '../src/api/videos'
import { ui } from '../src/lib/ui'
import { useUploads } from '../src/stores/uploads'
import VideosView from '../src/views/VideosView.vue'

vi.mock('tus-js-client', async () => (await import('./tusMock')).tusModule())
vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())

const VIDEOS = [
  { id: 2, name: 'Zwembad overzicht', durationSeconds: 95, fileSizeBytes: 3221225472, uploadedAt: '2026-10-22T09:14:03Z', thumbnailUrl: '/api/organisation/videos/2/thumbnail' },
  { id: 1, name: 'Duikplank', durationSeconds: 3723, fileSizeBytes: 52428800, uploadedAt: '2026-10-20T08:00:00Z', thumbnailUrl: '/api/organisation/videos/1/thumbnail' },
]

let pinia
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.mocked(listVideos).mockReset().mockResolvedValue(VIDEOS)
  vi.mocked(deleteVideo).mockReset().mockResolvedValue(null)
  ui.toasts.length = 0
  ui.confirm = null
})

async function mountView() {
  const wrapper = mount(VideosView, { global: { plugins: [pinia], stubs: { Teleport: true } } })
  await flushPromises()
  return wrapper
}

describe('video library view', () => {
  it('shows thumbnail, name, duration, size and upload date per video', async () => {
    const wrapper = await mountView()
    const cards = wrapper.findAll('.card')
    expect(cards).toHaveLength(2)
    const img = cards[0].find('img')
    expect(img.attributes('src')).toBe('/api/organisation/videos/2/thumbnail')
    expect(img.attributes('alt')).toBe('Zwembad overzicht')
    expect(cards[0].text()).toContain('Zwembad overzicht')
    expect(cards[0].text()).toContain('00:01:35')
    expect(cards[0].text()).toContain('3,0 GB')
    expect(cards[0].text()).toContain('22-10-2026')
    expect(cards[1].text()).toContain('01:02:03')
    expect(cards[1].text()).toContain('50,0 MB')
  })

  it('shows the empty state with the maximum size from the settings', async () => {
    vi.mocked(listVideos).mockResolvedValue([])
    const wrapper = await mountView()
    expect(wrapper.text()).toContain(
      "Er staan nog geen video's in de bibliotheek. Voeg een 360°-video toe (MP4, H.264, maximaal 10 GB).",
    )
    expect(wrapper.findAll('button').filter((b) => b.text() === 'Video toevoegen')).toHaveLength(2)
  })

  it('reloads the list when an upload was added to the library', async () => {
    await mountView()
    expect(listVideos).toHaveBeenCalledTimes(1)
    useUploads().addedCount++
    await flushPromises()
    expect(listVideos).toHaveBeenCalledTimes(2)
  })

  it('has no play button', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).not.toMatch(/afspelen/i)
  })
})

describe('deleting a video', () => {
  it('asks for confirmation and does nothing when cancelled', async () => {
    const wrapper = await mountView()
    await wrapper.findAll('.card')[0].find('button').trigger('click')
    expect(ui.confirm).toMatchObject({
      title: 'Video verwijderen?',
      body: '“Zwembad overzicht” verdwijnt uit de videobibliotheek.',
      confirmLabel: 'Verwijderen',
    })
    ui.confirm.resolve(false)
    await flushPromises()
    expect(deleteVideo).not.toHaveBeenCalled()
  })

  it('deletes after confirmation, shows a toast and reloads', async () => {
    const wrapper = await mountView()
    await wrapper.findAll('.card')[0].find('button').trigger('click')
    ui.confirm.resolve(true)
    await flushPromises()
    expect(deleteVideo).toHaveBeenCalledWith(2)
    expect(ui.toasts.map((t) => t.message)).toContain('Video verwijderd')
    expect(listVideos).toHaveBeenCalledTimes(2)
  })
})
