import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import CompletenessStatus from '../src/editor/CompletenessStatus.vue'
import CourseEditor from '../src/editor/CourseEditor.vue'
import QuestionNode from '../src/editor/QuestionNode.vue'
import { ANSWER_COLOURS, NEUTRAL_COLOUR, edgeColour, laneOffsets } from '../src/editor/edgeStyle'
import { ISSUE_GROUPS, groupIssues } from '../src/lib/completeness'
import { findNode } from '../src/lib/course'
import { ui } from '../src/lib/ui'
import { a, docs, mountEditor, s, settle } from './editorHarness'
import { editorStubs } from './editorStubs'
import { jsonResponse } from './helpers'

// Verbeterronde op feature 005 na de handmatige test: punten 1, 4, 5, 6 en 7.

beforeEach(() => {
  vi.useFakeTimers()
  ui.toasts.splice(0)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('punt 1: feedback bij opslaan', () => {
  async function mountCourseEditor(doc) {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)', component: { template: '<div />' } }] })
    await router.push('/courses/12')
    globalThis.fetch.mockImplementation(async () => jsonResponse(200, doc))
    const wrapper = mount(CourseEditor, {
      props: { doc },
      global: { plugins: [router], stubs: { ...editorStubs, CanvasEditor: true, OverviewList: true } },
    })
    return wrapper
  }

  it('shows "Concept opgeslagen" with a check and turns the button green for a moment', async () => {
    const v = docs.video({ isStart: true })
    const wrapper = await mountCourseEditor(docs.doc(v))
    wrapper.vm.$.setupState.course.name = 'Nieuwe naam'
    await settle()
    await wrapper.find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="saved-flash"]').text()).toBe('Concept opgeslagen')
    expect(wrapper.find('[data-test="save"]').classes()).toContain('just-saved')
    vi.advanceTimersByTime(2600)
    await nextTick()
    expect(wrapper.find('[data-test="saved-flash"]').text()).toBe('')
    expect(wrapper.find('[data-test="save"]').classes()).not.toContain('just-saved')
  })

  it('says "Opgeslagen, nog n punten open" when messages remain, so red does not look like a failed save', async () => {
    const v = docs.video({ isStart: true, videoId: null, video: null })
    const wrapper = await mountCourseEditor(docs.doc(v))
    wrapper.vm.$.setupState.course.name = 'Nieuwe naam'
    await settle()
    await wrapper.find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="saved-flash"]').text()).toBe('Opgeslagen, nog 1 punt open')
  })

  it('shows nothing when saving fails', async () => {
    const v = docs.video({ isStart: true })
    const wrapper = await mountCourseEditor(docs.doc(v))
    globalThis.fetch.mockImplementation(async () => jsonResponse(500, { error: { code: 'internal_error', message: 'Er ging iets mis.' } }))
    wrapper.vm.$.setupState.course.name = 'Nieuwe naam'
    await settle()
    await wrapper.find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="saved-flash"]').text()).toBe('')
  })
})

describe('punt 4: kleuren en banen', () => {
  it('gives every answer letter a fixed colour, and video connections a neutral one', () => {
    expect(ANSWER_COLOURS).toHaveLength(4)
    expect(new Set(ANSWER_COLOURS).size).toBe(4)
    expect(edgeColour(0)).toBe(ANSWER_COLOURS[0])
    expect(edgeColour(3)).toBe(ANSWER_COLOURS[3])
    expect(edgeColour(null)).toBe(NEUTRAL_COLOUR)
  })

  it('spreads connections into one step around the middle', () => {
    expect(laneOffsets(1)).toEqual([0])
    expect(laneOffsets(3)).toEqual([-16, 0, 16])
  })

  it('brings a connection in focus to the front: its steps stand out, the rest dims', async () => {
    const v = docs.video()
    const other = docs.question({ questionText: 'Andere' })
    const q = docs.question({ isStart: true })
    q.answers[0].nextStepId = v.id
    const { ed, wrapper } = mountEditor(docs.doc(q, v, other), { component: QuestionNode, props: (course) => ({ node: course.nodes[2] }) })
    ed.hoverEdge = `${s(q.id)}__a-${a(q.answers[0].id)}`
    await nextTick()
    expect(ed.focusEnds).toEqual([s(q.id), s(v.id)])
    expect(wrapper.find('[data-test="block"]').classes()).toContain('dimmed')
    ed.hoverEdge = null
    ed.selectEdge(`${s(q.id)}__a-${a(q.answers[0].id)}`)
    await nextTick()
    expect(ed.focusEnds).toEqual([s(q.id), s(v.id)])
    ed.clearSelection()
    await nextTick()
    expect(wrapper.find('[data-test="block"]').classes()).not.toContain('dimmed')
  })
})

describe('punt 6: gegroepeerde nog-te-doen-lijst', () => {
  it('puts each of the ten message types in exactly one group', () => {
    const codes = ISSUE_GROUPS.flatMap((g) => g.codes)
    expect(codes.sort()).toEqual(
      ['answerOpen', 'emptyAnswer', 'empty', 'neverEnds', 'noEnd', 'noQuestion', 'noStart', 'noVideo', 'unreachable', 'videoUnavailable'].sort(),
    )
    expect(new Set(codes).size).toBe(10)
    expect(ISSUE_GROUPS[0]).toMatchObject({ key: 'course', courseLevel: true })
  })

  it('groups issues in a fixed order and leaves out empty groups', () => {
    const groups = groupIssues([
      { id: 'noVideo:x', code: 'noVideo' },
      { id: 'noStart', code: 'noStart' },
      { id: 'noVideo:y', code: 'noVideo' },
    ])
    expect(groups.map((g) => [g.key, g.issues.length])).toEqual([
      ['course', 1],
      ['videos', 2],
    ])
  })

  it('shows the groups with counts, course apart, open below 5 points; a header folds, a row opens the step', async () => {
    const v1 = docs.video({ videoId: null, video: null })
    const q = docs.question({ isStart: true })
    q.answers[0].nextStepId = v1.id
    const { ed, wrapper } = mountEditor(docs.doc(q, v1), { component: CompletenessStatus })
    expect(wrapper.find('[data-test="todo"]').text()).toBe('2 nog te doen')
    await wrapper.find('[data-test="todo"]').trigger('click')
    const heads = wrapper.findAll('[data-test="group-head"]')
    expect(heads.map((h) => h.text())).toEqual(['Antwoorden zonder vervolg1', 'Video-onderdelen zonder video1'])
    expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-test="todo-item"]')[0].text()).toContain('Vraag: Wat doe je?')
    await heads[0].trigger('click')
    expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(1)
    await wrapper.findAll('[data-test="todo-item"]')[0].trigger('click')
    expect(ed.selectedId).toBe(s(v1.id))
  })

  it('starts folded from 5 points on, and keeps the course group apart', async () => {
    const steps = Array.from({ length: 5 }, () => docs.video({ videoId: null, video: null }))
    const { wrapper } = mountEditor(docs.doc(...steps), { component: CompletenessStatus })
    await wrapper.find('[data-test="todo"]').trigger('click')
    expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(0)
    expect(wrapper.find('[data-group="course"]').classes()).toContain('course')
    expect(wrapper.find('hr.split').exists()).toBe(true)
  })
})

describe('punt 7: canvas ordenen', () => {
  it('orders without a question, shows "Canvas geordend" with undo, and undo puts the blocks back', async () => {
    const left = docs.video({ positionX: 900, positionY: 900 })
    const q = docs.question({ isStart: true, positionX: 500, positionY: 500 })
    q.answers[0].nextStepId = left.id
    const { ed, history } = mountEditor(docs.doc(q, left))
    ed.tidyCanvas()
    expect(ui.confirm).toBeNull()
    const moved = findNode(ed.course, s(left.id))
    expect([moved.x, moved.y]).not.toEqual([900, 900])
    const toast = ui.toasts.at(-1)
    expect(toast).toMatchObject({ message: 'Canvas geordend', actionLabel: 'Ongedaan maken' })
    await settle()
    toast.action()
    await nextTick()
    expect(findNode(ed.course, s(left.id))).toMatchObject({ x: 900, y: 900 })
    expect(history.canRedo.value).toBe(true)
  })
})
