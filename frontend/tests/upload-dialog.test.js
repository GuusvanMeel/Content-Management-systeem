import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import UploadDialog from '../src/components/UploadDialog.vue'
import { listOtherOrganisations } from '../src/api/videos'
import { videoMessage } from '../src/lib/videoMessages'
import { ORGANISATIONS, SETTINGS } from './tusMock'

vi.mock('../src/lib/videoPreview', () => ({ createPreview: vi.fn(async () => null) }))
vi.mock('../src/api/videos', async () => (await import('./tusMock')).videosModule())

const FIXTURES = path.resolve(process.cwd(), '../backend/tests/fixtures/videos')
const fixtureFile = async (name) => new File([await readFile(path.join(FIXTURES, name))], name, { type: 'video/mp4' })

async function mountDialog(names, settings = SETTINGS) {
  const files = await Promise.all(names.map(fixtureFile))
  const wrapper = mount(UploadDialog, { props: { files, settings }, global: { stubs: { Teleport: true } } })
  await vi.waitFor(async () => {
    await flushPromises()
    expect(wrapper.find('[data-test="checking"]').exists()).toBe(false)
  })
  return wrapper
}

const uploadButton = (wrapper) => wrapper.findAll('button').find((b) => b.text() === 'Uploaden')

describe('upload dialog: checks before uploading (FR-013)', () => {
  it('enables "Uploaden" for a valid file and sends the chosen name', async () => {
    const wrapper = await mountDialog(['valid-512x256.mp4'])
    expect(uploadButton(wrapper).attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="problem"]').exists()).toBe(false)

    await wrapper.find('input').setValue('Zwembad overzicht')
    await wrapper.find('form').trigger('submit')

    const [[entries]] = wrapper.emitted('submit')
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('Zwembad overzicht')
    expect(entries[0].file.name).toBe('valid-512x256.mp4')
  })

  it.each([
    ['clip.mov', 'video_unsupported_format'],
    ['h265-512x256.mp4', 'video_unsupported_codec'],
    ['not-360-640x360.mp4', 'video_not_360'],
    ['too-large-6144x3072.mp4', 'video_resolution_too_high'],
  ])('shows the problem with %s in red and keeps "Uploaden" off', async (name, code) => {
    const wrapper = await mountDialog([name])
    const problem = wrapper.find('[data-test="problem"]')
    expect(problem.text()).toBe(videoMessage(code, SETTINGS))
    expect(wrapper.find('[data-test="entry"]').classes()).toContain('invalid')
    expect(uploadButton(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('lets a file through that the browser cannot read (FR-013b)', async () => {
    const wrapper = await mountDialog(['corrupt.mp4'])
    expect(wrapper.find('[data-test="problem"]').exists()).toBe(false)
    expect(uploadButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('keeps "Uploaden" off until the invalid file is taken out of the list', async () => {
    const wrapper = await mountDialog(['valid-512x256.mp4', 'square-1024x1024.mp4'])
    expect(uploadButton(wrapper).attributes('disabled')).toBeDefined()

    await wrapper.findAll('[data-test="entry"]')[1].find('button.remove').trigger('click')

    expect(wrapper.findAll('[data-test="entry"]')).toHaveLength(1)
    expect(uploadButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('closes when the last file is taken out, without sending anything', async () => {
    const wrapper = await mountDialog(['clip.mov'])
    await wrapper.find('button.remove').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})

describe('upload dialog: availability per video (specs/003 FR-001 – FR-004)', () => {
  it('pre-selects the configured default', async () => {
    const wrapper = await mountDialog(['valid-512x256.mp4'], { ...SETTINGS, defaultVisibility: 'public' })
    expect(wrapper.find('[data-test="visibility-public"]').element.checked).toBe(true)
    expect(wrapper.find('[data-test="visibility-private"]').element.checked).toBe(false)
  })

  it('keeps "Uploaden" off for "Selectief beschikbaar" without an organisation', async () => {
    const wrapper = await mountDialog(['valid-512x256.mp4'])
    await wrapper.find('[data-test="visibility-selective"]').setValue(true)
    expect(wrapper.find('[data-test="no-organisation"]').text()).toBe(
      'Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.',
    )
    expect(uploadButton(wrapper).attributes('disabled')).toBeDefined()

    await wrapper.find(`[data-test="organisation-${ORGANISATIONS[1].id}"]`).setValue(true)
    expect(wrapper.find('[data-test="no-organisation"]').exists()).toBe(false)
    expect(uploadButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('disables "Selectief beschikbaar" when there are no other organisations', async () => {
    vi.mocked(listOtherOrganisations).mockResolvedValueOnce([])
    const wrapper = await mountDialog(['valid-512x256.mp4'])
    expect(wrapper.find('[data-test="visibility-selective"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Er zijn nog geen andere organisaties.')
  })

  it('sends availability and chosen organisations per file', async () => {
    const wrapper = await mountDialog(['valid-512x256.mp4', 'valid-silent-1024x512.mp4'])
    // Look the entry up again each time: re-rendering inside the stubbed Teleport replaces the elements.
    const entry = (index) => wrapper.findAll('[data-test="entry"]')[index]
    await entry(0).find('[data-test="visibility-selective"]').setValue(true)
    await entry(0).find(`[data-test="organisation-${ORGANISATIONS[0].id}"]`).setValue(true)
    await entry(1).find('[data-test="visibility-public"]').setValue(true)
    await wrapper.find('form').trigger('submit')

    const [[entries]] = wrapper.emitted('submit')
    expect(entries.map(({ visibility, accessOrganisationIds }) => ({ visibility, accessOrganisationIds }))).toEqual([
      { visibility: 'selective', accessOrganisationIds: [ORGANISATIONS[0].id] },
      { visibility: 'public', accessOrganisationIds: [] },
    ])
  })
})

describe('upload dialog: description (specs/003 FR-020, FR-021)', () => {
  it('has an optional description with a counter, sent with the file', async () => {
    const wrapper = await mountDialog(['valid-512x256.mp4'])
    expect(wrapper.find('[data-test="description-counter"]').text()).toBe('1000 tekens over')
    await wrapper.find('[data-test="description"]').setValue('Overzicht\nvan het bad')
    expect(wrapper.find('[data-test="description-counter"]').text()).toBe('979 tekens over')
    expect(wrapper.find('[data-test="description-counter"]').classes()).not.toContain('limit')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')[0][0][0].description).toBe('Overzicht\nvan het bad')
  })

  it('cuts pasted text to 1000 characters counted like the server', async () => {
    const wrapper = await mountDialog(['valid-512x256.mp4'])
    await wrapper.find('[data-test="description"]').setValue('😀' + 'a'.repeat(1000))
    expect(wrapper.find('[data-test="description-counter"]').text()).toBe('0 tekens over')
    expect(wrapper.find('[data-test="description-counter"]').classes()).toContain('limit')
    // The "rest is niet overgenomen" message is tested in description-field.test.js: the stubbed
    // Teleport re-creates the field here, so its local state does not survive a re-render.
    await wrapper.find('form').trigger('submit')
    const sent = wrapper.emitted('submit')[0][0][0].description
    expect([...sent]).toHaveLength(1000)
    expect(sent.startsWith('😀')).toBe(true)
  })
})
