import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import UploadDialog from '../src/components/UploadDialog.vue'
import { videoMessage } from '../src/lib/videoMessages'
import { SETTINGS } from './tusMock'

vi.mock('../src/lib/videoPreview', () => ({ createPreview: vi.fn(async () => null) }))

const FIXTURES = path.resolve(process.cwd(), '../backend/tests/fixtures/videos')
const fixtureFile = async (name) => new File([await readFile(path.join(FIXTURES, name))], name, { type: 'video/mp4' })

async function mountDialog(names) {
  const files = await Promise.all(names.map(fixtureFile))
  const wrapper = mount(UploadDialog, { props: { files, settings: SETTINGS }, global: { stubs: { Teleport: true } } })
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
