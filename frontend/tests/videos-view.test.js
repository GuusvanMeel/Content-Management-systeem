import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteVideo, getVideo, listVideos } from '../src/api/videos'
import { ui } from '../src/lib/ui'
import { useUploads } from '../src/stores/uploads'
import VideosView from '../src/views/VideosView.vue'

vi.mock('tus-js-client', async () => (await import('./tusMock')).tusModule())
vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())
vi.mock('../src/lib/videoPreview', () => ({ createPreview: vi.fn(async () => null) }))

const OWN = { id: 3, name: 'Zwembad A', isOwn: true }
const OTHER = { id: 4, name: 'Brandweer Academie Noord', isOwn: false }

const VIDEOS = [
  {
    id: 2, name: 'Zwembad overzicht', description: 'Overzicht van het diepe bad.\nGeschikt als start.',
    durationSeconds: 95, fileSizeBytes: 3221225472, uploadedAt: '2026-10-22T09:14:03Z',
    thumbnailUrl: '/api/organisation/videos/2/thumbnail', owner: OWN, visibility: 'public',
  },
  {
    id: 1, name: 'Duikplank', description: null,
    durationSeconds: 3723, fileSizeBytes: 52428800, uploadedAt: '2026-10-20T08:00:00Z',
    thumbnailUrl: '/api/organisation/videos/1/thumbnail', owner: OWN, visibility: 'private',
  },
  {
    id: 7, name: 'Rookontwikkeling', description: 'Brand in de keuken',
    durationSeconds: 300, fileSizeBytes: 1048576000, uploadedAt: '2026-10-21T10:00:00Z',
    thumbnailUrl: '/api/organisation/videos/7/thumbnail', owner: OTHER,
  },
]

let pinia
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.mocked(listVideos).mockReset().mockResolvedValue(VIDEOS)
  vi.mocked(deleteVideo).mockReset().mockResolvedValue(null)
  vi.mocked(getVideo).mockReset().mockImplementation(async (id) => VIDEOS.find((v) => v.id === id))
  ui.toasts.length = 0
  ui.confirm = null
})

async function mountView() {
  const wrapper = mount(VideosView, { global: { plugins: [pinia], stubs: { Teleport: true } } })
  await flushPromises()
  return wrapper
}

const cardNames = (wrapper) => wrapper.findAll('[data-test="video"] .name').map((n) => n.text())
const cardOf = (wrapper, name) => wrapper.findAll('[data-test="video"]').find((c) => c.find('.name').text() === name)

describe('video library view', () => {
  it('shows thumbnail, name, duration, size and upload date per video, newest first', async () => {
    const wrapper = await mountView()
    expect(cardNames(wrapper)).toEqual(['Zwembad overzicht', 'Rookontwikkeling', 'Duikplank'])
    const card = cardOf(wrapper, 'Zwembad overzicht')
    const img = card.find('img')
    expect(img.attributes('src')).toBe('/api/organisation/videos/2/thumbnail')
    expect(img.attributes('alt')).toBe('Zwembad overzicht')
    expect(img.attributes('loading')).toBe('lazy')
    expect(card.text()).toContain('00:01:35')
    expect(card.text()).toContain('3,0 GB')
    expect(card.text()).toContain('22-10-2026')
    expect(cardOf(wrapper, 'Duikplank').text()).toContain('01:02:03')
    expect(cardOf(wrapper, 'Duikplank').text()).toContain('50,0 MB')
  })

  it('marks other organisations with a coloured pill and own videos with a neutral one (FR-009)', async () => {
    const wrapper = await mountView()
    const ownPill = cardOf(wrapper, 'Zwembad overzicht').find('[data-test="owner"]')
    expect(ownPill.text()).toBe('Eigen')
    expect(ownPill.classes()).toEqual(expect.arrayContaining(['pill', 'own']))
    expect(ownPill.element.tagName).toBe('SPAN')
    expect(cardOf(wrapper, 'Zwembad overzicht').find('[data-test="visibility"]').text()).toBe('Algemeen')
    expect(cardOf(wrapper, 'Duikplank').find('[data-test="visibility"]').text()).toBe('Alleen eigen organisatie')

    const other = cardOf(wrapper, 'Rookontwikkeling')
    const otherPill = other.find('[data-test="owner"]')
    expect(otherPill.text()).toBe('Brandweer Academie Noord')
    expect(otherPill.classes()).toEqual(expect.arrayContaining(['pill', 'other']))
    expect(otherPill.attributes('title')).toBe("Toon alleen video's van Brandweer Academie Noord")
    expect(other.find('[data-test="visibility"]').exists()).toBe(false)
  })

  it('shows "Verwijderen" only for own videos (FR-014)', async () => {
    const wrapper = await mountView()
    expect(cardOf(wrapper, 'Zwembad overzicht').find('[data-test="delete"]').exists()).toBe(true)
    expect(cardOf(wrapper, 'Rookontwikkeling').find('[data-test="delete"]').exists()).toBe(false)
  })

  it('shows a shortened description, and nothing for a video without one (FR-022)', async () => {
    const wrapper = await mountView()
    const description = cardOf(wrapper, 'Zwembad overzicht').find('[data-test="description"]')
    expect(description.text()).toContain('Overzicht van het diepe bad.')
    expect(description.classes()).toContain('description')
    expect(cardOf(wrapper, 'Duikplank').find('[data-test="description"]').exists()).toBe(false)
  })

  it('shows the empty state with the maximum size from the settings', async () => {
    vi.mocked(listVideos).mockResolvedValue([])
    const wrapper = await mountView()
    expect(wrapper.text()).toContain(
      "Er staan nog geen video's in de bibliotheek. Voeg een 360°-video toe (MP4, H.264, maximaal 10 GB).",
    )
    expect(wrapper.findAll('button').filter((b) => b.text() === 'Video toevoegen')).toHaveLength(2)
    expect(wrapper.find('[data-test="toolbar"]').exists()).toBe(false)
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

describe('video window (FR-012)', () => {
  it('opens on top of the list and leaves the list as it was after closing', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-test="search"]').setValue('overzicht')
    await cardOf(wrapper, 'Zwembad overzicht').find('button.open').trigger('click')
    await flushPromises()
    expect(getVideo).toHaveBeenCalledWith(2)
    expect(wrapper.find('[data-test="view"]').exists()).toBe(true)

    await wrapper.findAll('button').find((b) => b.text() === 'Sluiten').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="view"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="search"]').element.value).toBe('overzicht')
    expect(cardNames(wrapper)).toEqual(['Zwembad overzicht'])
    expect(listVideos).toHaveBeenCalledTimes(1)
  })
})

describe('search, filter and sort (FR-023 – FR-026)', () => {
  it('has the toolbar with the default choices', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[data-test="search"]').attributes('placeholder')).toBe('Zoeken op naam, beschrijving of organisatie')
    expect(wrapper.find('[data-test="ownership-all"]').attributes('aria-pressed')).toBe('true')
    const options = wrapper.findAll('[data-test="sort"] option').map((o) => o.text())
    expect(options).toEqual([
      'Nieuwste eerst', 'Oudste eerst', 'Naam (A–Z)', 'Naam (Z–A)',
      'Langste eerst', 'Kortste eerst', 'Grootste eerst', 'Kleinste eerst',
    ])
    expect(wrapper.find('[data-test="sort"]').element.value).toBe('newest')
  })

  it('searches name, description and owner without asking the API', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-test="search"]').setValue('keuken')
    expect(cardNames(wrapper)).toEqual(['Rookontwikkeling'])
    await wrapper.find('[data-test="search"]').setValue('brandweer')
    expect(cardNames(wrapper)).toEqual(['Rookontwikkeling'])
    expect(listVideos).toHaveBeenCalledTimes(1)
  })

  it('filters and sorts together', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-test="ownership-own"]').trigger('click')
    await wrapper.find('[data-test="sort"]').setValue('longest')
    expect(cardNames(wrapper)).toEqual(['Duikplank', 'Zwembad overzicht'])
    await wrapper.find('[data-test="ownership-others"]').trigger('click')
    expect(cardNames(wrapper)).toEqual(['Rookontwikkeling'])
  })

  it('shows "Geen video\'s gevonden" and clears search and filter', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-test="ownership-others"]').trigger('click')
    await wrapper.find('[data-test="search"]').setValue('bestaat niet')
    expect(wrapper.find('[data-test="no-results"]').text()).toContain("Geen video's gevonden")

    await wrapper.findAll('button').find((b) => b.text() === 'Zoekterm en filter wissen').trigger('click')
    expect(wrapper.find('[data-test="search"]').element.value).toBe('')
    expect(cardNames(wrapper)).toHaveLength(3)
  })
})

describe('filter on an organisation (FR-025b)', () => {
  const MORE = [
    ...VIDEOS,
    {
      id: 9, name: 'Reddingsoefening', description: null, durationSeconds: 60, fileSizeBytes: 1000,
      uploadedAt: '2026-10-19T10:00:00Z', thumbnailUrl: '/api/organisation/videos/9/thumbnail',
      owner: { id: 5, name: 'Zwembad B', isOwn: false },
    },
    {
      id: 8, name: 'Brand in het trappenhuis', description: null, durationSeconds: 400, fileSizeBytes: 1000,
      uploadedAt: '2026-10-18T10:00:00Z', thumbnailUrl: '/api/organisation/videos/8/thumbnail', owner: OTHER,
    },
  ]
  const chip = (wrapper) => wrapper.find('[data-test="owner-filter"]')

  beforeEach(() => {
    vi.mocked(listVideos).mockResolvedValue(MORE)
  })

  it('filters on the organisation of a clicked pill, without opening the video window', async () => {
    const wrapper = await mountView()
    expect(chip(wrapper).exists()).toBe(false)
    await cardOf(wrapper, 'Rookontwikkeling').find('[data-test="owner"]').trigger('click')

    expect(cardNames(wrapper)).toEqual(['Rookontwikkeling', 'Brand in het trappenhuis'])
    expect(chip(wrapper).text()).toContain('Organisatie: Brandweer Academie Noord')
    expect(chip(wrapper).attributes('aria-label')).toBe('Filter op Brandweer Academie Noord wissen')
    expect(getVideo).not.toHaveBeenCalled()
  })

  it('works together with search, sort and the own/others filter', async () => {
    const wrapper = await mountView()
    await cardOf(wrapper, 'Rookontwikkeling').find('[data-test="owner"]').trigger('click')
    await wrapper.find('[data-test="sort"]').setValue('longest')
    expect(cardNames(wrapper)).toEqual(['Brand in het trappenhuis', 'Rookontwikkeling'])
    await wrapper.find('[data-test="search"]').setValue('keuken')
    expect(cardNames(wrapper)).toEqual(['Rookontwikkeling'])
    await wrapper.find('[data-test="search"]').setValue('')
    await wrapper.find('[data-test="ownership-own"]').trigger('click')
    expect(wrapper.find('[data-test="no-results"]').exists()).toBe(true)
  })

  it('removes only the organisation filter when the chip is clicked', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-test="search"]').setValue('brand')
    await cardOf(wrapper, 'Rookontwikkeling').find('[data-test="owner"]').trigger('click')
    await chip(wrapper).trigger('click')

    expect(chip(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-test="search"]').element.value).toBe('brand')
    expect(cardNames(wrapper)).toEqual(['Rookontwikkeling', 'Brand in het trappenhuis'])
  })

  it('is cleared by "Zoekterm en filter wissen"', async () => {
    const wrapper = await mountView()
    await cardOf(wrapper, 'Reddingsoefening').find('[data-test="owner"]').trigger('click')
    await wrapper.find('[data-test="search"]').setValue('bestaat niet')
    await wrapper.findAll('button').find((b) => b.text() === 'Zoekterm en filter wissen').trigger('click')
    expect(chip(wrapper).exists()).toBe(false)
    expect(cardNames(wrapper)).toHaveLength(5)
  })

  it('is set from the pill in the video window, which then closes', async () => {
    vi.mocked(getVideo).mockImplementation(async (id) => MORE.find((v) => v.id === id))
    const wrapper = await mountView()
    await cardOf(wrapper, 'Reddingsoefening').find('button.open').trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="view"] [data-test="owner"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="view"]').exists()).toBe(false)
    expect(chip(wrapper).text()).toContain('Organisatie: Zwembad B')
    expect(cardNames(wrapper)).toEqual(['Reddingsoefening'])
  })

  it('does nothing when the neutral "Eigen" pill is clicked', async () => {
    const wrapper = await mountView()
    await cardOf(wrapper, 'Duikplank').find('[data-test="owner"]').trigger('click')
    expect(chip(wrapper).exists()).toBe(false)
    expect(cardNames(wrapper)).toHaveLength(5)
  })
})

describe('deleting a video', () => {
  it('asks for confirmation and does nothing when cancelled', async () => {
    const wrapper = await mountView()
    await cardOf(wrapper, 'Zwembad overzicht').find('[data-test="delete"]').trigger('click')
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
    await cardOf(wrapper, 'Zwembad overzicht').find('[data-test="delete"]').trigger('click')
    ui.confirm.resolve(true)
    await flushPromises()
    expect(deleteVideo).toHaveBeenCalledWith(2)
    expect(ui.toasts.map((t) => t.message)).toContain('Video verwijderd')
    expect(listVideos).toHaveBeenCalledTimes(2)
  })
})

describe('choosing files', () => {
  it('opens the upload dialog for the chosen files instead of uploading straight away', async () => {
    const wrapper = await mountView()
    const input = wrapper.find('input[type="file"]')
    const files = [new File(['x'], 'a.mp4', { type: 'video/mp4' }), new File(['y'], 'b.mov')]
    Object.defineProperty(input.element, 'files', { value: files, configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain("Video's toevoegen (2)")
    expect(useUploads().items).toEqual([])
  })
})

describe('round upload button (FR-006a)', () => {
  it('opens the file picker of this page through the uploads store, until the page is left', async () => {
    const wrapper = await mountView()
    const click = vi.spyOn(wrapper.find('input[type="file"]').element, 'click').mockImplementation(() => {})
    useUploads().openFilePicker()
    expect(click).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    useUploads().openFilePicker()
    expect(click).toHaveBeenCalledTimes(1)
  })
})
