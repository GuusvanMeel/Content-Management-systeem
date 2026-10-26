import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import VideoNode from '../src/editor/VideoNode.vue'
import { provideEditor } from '../src/editor/context'
import { toEditor } from '../src/lib/courseMapping'
import { useCourseHistory } from '../src/lib/history'
import { ui } from '../src/lib/ui'

// The warning before removing a video that the organisation can no longer pick, and undo after
// such a removal was saved (specs/004 FR-020b, FR-020d, SC-005b, research R5b).

const NOTICE = 'Deze video is niet meer beschikbaar en kan niet worden teruggezet.'
const LIBRARY_VIDEO = { id: 20, name: 'Nieuw', durationSeconds: 30, thumbnailUrl: '/api/organisation/videos/20/thumbnail' }

const stepVideo = (videoId, available, extra = {}) => ({
  id: 101,
  stepType: 'video',
  isStart: true,
  positionX: 0,
  positionY: 0,
  videoId,
  video: { id: videoId, name: `Video ${videoId}`, durationSeconds: 60, thumbnailUrl: `/t/${videoId}`, available },
  ...extra,
})
const docWith = (...steps) => ({ id: 12, name: 'Redding', description: 'Diep bad', steps })

let ed
let history
let save
let wrapper

/** Mounts a provided editor with the video block of the first step. */
function mountEditor(doc) {
  const Harness = defineComponent({
    setup() {
      const initial = toEditor(doc)
      const course = ref(initial.course)
      history = useCourseHistory(() => course.value)
      ed = provideEditor({ course, stepVideos: initial.stepVideos, doc, history, save })
      return () => (course.value.nodes[0] ? h(VideoNode, { node: course.value.nodes[0] }) : h('div'))
    },
  })
  wrapper = mount(Harness)
}

/** Lets the history's 350 ms grouping pass. */
async function settle() {
  await nextTick()
  vi.advanceTimersByTime(400)
}

/** Waits for the confirm dialog and answers it. Returns its title. */
async function answer(value) {
  await nextTick()
  const title = ui.confirm?.title
  ui.confirm.resolve(value)
  await nextTick()
  return title
}

const node = () => ed.course.nodes[0]

beforeEach(() => {
  vi.useFakeTimers()
  save = vi.fn()
  ui.confirm = null
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

describe('the warning for a video that is no longer available (FR-020b)', () => {
  beforeEach(() => mountEditor(docWith(stepVideo(17, false))))

  it('asks before removing the step; cancel keeps everything', async () => {
    const removing = ed.removeNode('s101')
    expect(await answer(false)).toBe('Video niet meer beschikbaar')
    expect(await removing).toBe(false)
    expect(ed.course.nodes).toHaveLength(1)
    expect(node().videoId).toBe(17)
    expect(ed.dirty).toBe(false)
  })

  it('asks before "Video weghalen"; cancel keeps the video', async () => {
    const clearing = ed.clearVideo(node())
    expect(await answer(false)).toBe('Video niet meer beschikbaar')
    await clearing
    expect(node().videoId).toBe(17)
    expect(ed.dirty).toBe(false)
  })

  it('asks before choosing another video; cancel keeps the video', async () => {
    const choosing = ed.chooseVideo(node(), LIBRARY_VIDEO)
    expect(await answer(false)).toBe('Video niet meer beschikbaar')
    expect(await choosing).toBe(false)
    expect(node().videoId).toBe(17)
  })

  it('goes ahead on "Doorgaan", and undo before saving brings the video back', async () => {
    const removing = ed.removeNode('s101')
    await answer(true)
    expect(await removing).toBe(true)
    expect(ed.course.nodes).toHaveLength(0)
    await settle()
    history.undo()
    await nextTick()
    expect(node()).toMatchObject({ id: 's101', videoId: 17 })
    expect(ed.lostVideoNotices.has('s101')).toBe(false)
  })
})

describe('no warning for a video that is still available', () => {
  beforeEach(() => mountEditor(docWith(stepVideo(17, true))))

  it('removes, clears and replaces without asking', async () => {
    expect(await ed.chooseVideo(node(), LIBRARY_VIDEO)).toBe(true)
    expect(ui.confirm).toBeNull()
    expect(node().videoId).toBe(20)
    await ed.clearVideo(node())
    expect(ui.confirm).toBeNull()
    expect(node().videoId).toBeNull()
    expect(await ed.removeNode('s101')).toBe(true)
    expect(ui.confirm).toBeNull()
  })
})

describe('undo after the removal was saved (FR-020d)', () => {
  beforeEach(() => mountEditor(docWith(stepVideo(17, false))))

  async function removeAndSave() {
    const removing = ed.removeNode('s101')
    await answer(true)
    await removing
    await settle()
    save.mockResolvedValueOnce(docWith())
    expect(await ed.saveDraft()).toBe(true)
  }

  it('restores the step without the video and with the notice', async () => {
    await removeAndSave()
    history.undo()
    await nextTick()
    expect(node()).toMatchObject({ id: 's101', type: 'video', videoId: null })
    expect(ed.lostVideoNotices.has('s101')).toBe(true)
    expect(wrapper.text()).toContain(NOTICE)
  })

  it('does not send the video with the next save', async () => {
    await removeAndSave()
    history.undo()
    await nextTick()
    save.mockResolvedValueOnce(docWith({ ...stepVideo(null, true), id: 103, video: null }))
    await ed.saveDraft()
    const payload = save.mock.calls[1][0]
    expect(payload.steps).toEqual([{ stepType: 'video', isStart: true, positionX: 0, positionY: 0, videoId: null }])
  })

  it('keeps redo working', async () => {
    await removeAndSave()
    history.undo()
    await nextTick()
    history.redo()
    await nextTick()
    expect(ed.course.nodes).toHaveLength(0)
    history.undo()
    await nextTick()
    expect(node().videoId).toBeNull()
  })

  it('drops the notice once a video is chosen', async () => {
    await removeAndSave()
    history.undo()
    await nextTick()
    expect(await ed.chooseVideo(node(), LIBRARY_VIDEO)).toBe(true)
    expect(ui.confirm).toBeNull()
    expect(node().videoId).toBe(20)
    expect(ed.lostVideoNotices.has('s101')).toBe(false)
    await nextTick()
    expect(wrapper.text()).not.toContain(NOTICE)
  })
})

describe('undo after replacing the video was saved (FR-020d)', () => {
  beforeEach(() => mountEditor(docWith(stepVideo(17, false))))

  it('leaves the block empty with the notice, and redo brings the new video back', async () => {
    const choosing = ed.chooseVideo(node(), LIBRARY_VIDEO)
    await answer(true)
    await choosing
    await settle()
    save.mockResolvedValueOnce(docWith(stepVideo(20, true)))
    await ed.saveDraft()
    history.undo()
    await nextTick()
    expect(node()).toMatchObject({ id: 's101', videoId: null })
    expect(ed.lostVideoNotices.has('s101')).toBe(true)
    history.redo()
    await nextTick()
    expect(node().videoId).toBe(20)
  })
})
