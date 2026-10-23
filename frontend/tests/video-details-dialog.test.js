import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getVideo, listOtherOrganisations, updateVideo } from '../src/api/videos'
import { ApiError } from '../src/api/client'
import { ui } from '../src/lib/ui'
import VideoDetailsDialog from '../src/components/VideoDetailsDialog.vue'

vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())

const ORGS = [
  { id: 4, name: 'Brandweer Academie Noord' },
  { id: 9, name: 'Zwembad B' },
  { id: 12, name: 'Zwembad C' },
]

const base = {
  id: 2, name: 'Zwembad overzicht', description: 'Regel 1\nRegel 2',
  durationSeconds: 95, fileSizeBytes: 3221225472, uploadedAt: '2026-10-22T09:14:03Z',
  thumbnailUrl: '/api/organisation/videos/2/thumbnail',
}
const OTHERS_VIDEO = { ...base, owner: { id: 4, name: 'Brandweer Academie Noord', isOwn: false } }
const OWN_PUBLIC = { ...base, owner: { id: 3, name: 'Zwembad A', isOwn: true }, visibility: 'public' }
const OWN_SELECTIVE = { ...OWN_PUBLIC, visibility: 'selective', accessOrganisations: [ORGS[1]] }

beforeEach(() => {
  vi.mocked(getVideo).mockReset()
  vi.mocked(updateVideo).mockReset()
  vi.mocked(listOtherOrganisations).mockReset().mockResolvedValue(ORGS)
  ui.toasts.length = 0
  ui.confirm = null
})

async function mountDialog(video) {
  vi.mocked(getVideo).mockResolvedValue(video)
  const wrapper = mount(VideoDetailsDialog, { props: { videoId: video.id }, global: { stubs: { Teleport: true } } })
  await flushPromises()
  return wrapper
}

const buttonNames = (wrapper) => wrapper.findAll('.modal-foot button').map((b) => b.text())
const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text() === text)

describe('viewing a video (FR-012)', () => {
  it('shows a video of another organisation read-only', async () => {
    const wrapper = await mountDialog(OTHERS_VIDEO)
    const pill = wrapper.find('[data-test="owner"]')
    expect(pill.text()).toBe('Brandweer Academie Noord')
    expect(pill.element.tagName).toBe('BUTTON')
    expect(pill.classes()).toContain('other')
    expect(wrapper.find('[data-test="description"]').element.textContent).toBe('Regel 1\nRegel 2')
    expect(wrapper.text()).toContain('00:01:35')
    expect(wrapper.text()).toContain('3,0 GB')
    expect(wrapper.text()).toContain('22-10-2026')
    expect(wrapper.find('[data-test="availability-text"]').exists()).toBe(false)
    expect(buttonNames(wrapper)).toEqual(['Sluiten'])
  })

  it('shows availability and the owner buttons for an own video', async () => {
    const wrapper = await mountDialog(OWN_SELECTIVE)
    expect(wrapper.find('[data-test="owner"]').text()).toBe('Eigen')
    expect(wrapper.find('[data-test="owner"]').element.tagName).toBe('SPAN')
    expect(wrapper.find('[data-test="availability-text"]').text()).toBe('Selectief beschikbaar: Zwembad B')
    expect(buttonNames(wrapper)).toEqual(['Verwijderen', 'Wijzigen', 'Sluiten'])
  })

  it('asks the library to filter on the owner when the pill is clicked (FR-025b)', async () => {
    const wrapper = await mountDialog(OTHERS_VIDEO)
    await wrapper.find('[data-test="owner"]').trigger('click')
    expect(wrapper.emitted('filter-owner')).toEqual([[OTHERS_VIDEO.owner]])
  })

  it('says so when every chosen organisation is gone', async () => {
    const wrapper = await mountDialog({ ...OWN_SELECTIVE, accessOrganisations: [] })
    expect(wrapper.find('[data-test="availability-text"]').text()).toBe(
      'Selectief beschikbaar: geen organisaties meer gekozen. Alleen jouw organisatie ziet deze video.',
    )
  })

  it('reports a video that is no longer available', async () => {
    vi.mocked(getVideo).mockRejectedValue(new ApiError(404, 'not_found', 'Niet gevonden.'))
    const wrapper = mount(VideoDetailsDialog, { props: { videoId: 2 }, global: { stubs: { Teleport: true } } })
    await flushPromises()
    expect(wrapper.find('[data-test="load-error"]').text()).toBe('Deze video is niet meer beschikbaar.')
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })
})

describe('editing an own video (FR-012a, FR-017a)', () => {
  async function startEditing(video) {
    const wrapper = await mountDialog(video)
    await button(wrapper, 'Wijzigen').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('shows name, description with counter and availability', async () => {
    const wrapper = await startEditing(OWN_PUBLIC)
    expect(wrapper.find('[data-test="edit-name"]').element.value).toBe('Zwembad overzicht')
    expect(wrapper.find('[data-test="description"]').element.value).toBe('Regel 1\nRegel 2')
    expect(wrapper.find('[data-test="description-counter"]').text()).toBe('985 tekens over')
    expect(wrapper.find('[data-test="visibility-public"]').element.checked).toBe(true)
  })

  it('asks first when organisations lose access, and saves nothing when cancelled', async () => {
    const wrapper = await startEditing(OWN_PUBLIC)
    await wrapper.find('[data-test="visibility-selective"]').setValue(true)
    await wrapper.find('[data-test="organisation-9"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(ui.confirm).toMatchObject({
      title: 'Beschikbaarheid beperken?',
      body: '2 organisaties kunnen deze video daarna niet meer zien.',
      confirmLabel: 'Wijzigen',
    })
    ui.confirm.resolve(false)
    await flushPromises()
    expect(updateVideo).not.toHaveBeenCalled()
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('saves after confirming, shows a toast and reports the change', async () => {
    vi.mocked(updateVideo).mockResolvedValue({ ...OWN_SELECTIVE })
    const wrapper = await startEditing(OWN_PUBLIC)
    await wrapper.find('[data-test="visibility-selective"]').setValue(true)
    await wrapper.find('[data-test="organisation-9"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    ui.confirm.resolve(true)
    await flushPromises()

    expect(updateVideo).toHaveBeenCalledWith(2, {
      name: 'Zwembad overzicht',
      description: 'Regel 1\nRegel 2',
      visibility: 'selective',
      accessOrganisationIds: [9],
    })
    expect(ui.toasts.map((t) => t.message)).toContain('Wijzigingen opgeslagen')
    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(wrapper.find('[data-test="view"]').exists()).toBe(true)
  })

  it('saves widening without asking', async () => {
    vi.mocked(updateVideo).mockResolvedValue({ ...OWN_PUBLIC })
    const wrapper = await startEditing(OWN_SELECTIVE)
    await wrapper.find('[data-test="visibility-public"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(ui.confirm).toBeNull()
    expect(updateVideo).toHaveBeenCalled()
  })

  it('shows field errors from the API under the field', async () => {
    vi.mocked(updateVideo).mockRejectedValue(
      new ApiError(400, 'validation_failed', 'Controleer de ingevulde gegevens.', { name: 'Vul een naam in.' }),
    )
    const wrapper = await startEditing(OWN_PUBLIC)
    await wrapper.find('[data-test="edit-name"]').setValue('  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Vul een naam in.')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('turns the counter red at the limit and refuses more text (FR-021)', async () => {
    const wrapper = await startEditing(OWN_PUBLIC)
    await wrapper.find('[data-test="description"]').setValue('x'.repeat(1200))
    expect(wrapper.find('[data-test="description"]').element.value).toHaveLength(1000)
    expect(wrapper.find('[data-test="description-counter"]').text()).toBe('0 tekens over')
    expect(wrapper.find('[data-test="description-counter"]').classes()).toContain('limit')

    await wrapper.find('[data-test="description"]').setValue('x'.repeat(999))
    expect(wrapper.find('[data-test="description-counter"]').text()).toBe('1 teken over')
    expect(wrapper.find('[data-test="description-counter"]').classes()).not.toContain('limit')
    // The cut-off message itself is tested in description-field.test.js (see upload-dialog.test.js).
  })

  it('closes on "Annuleren" without saving', async () => {
    const wrapper = await startEditing(OWN_PUBLIC)
    await wrapper.find('[data-test="edit-name"]').setValue('Iets anders')
    await button(wrapper, 'Annuleren').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(updateVideo).not.toHaveBeenCalled()
  })
})
