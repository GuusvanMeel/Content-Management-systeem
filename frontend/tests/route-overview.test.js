import { describe, expect, it } from 'vitest'
import OverviewList from '../src/editor/OverviewList.vue'
import { autoLayout, findNode } from '../src/lib/course'
import { docs, mountEditor, s } from './editorHarness'

// The route written out in the "Lijst" view, and "Canvas ordenen" (specs/005 US5, FR-024, FR-025).

describe('route overview', () => {
  it('writes out the route with branches, ends, a loop and unreachable steps', () => {
    const end = docs.video({ videoId: 19, video: { id: 19, name: 'Einde-video', durationSeconds: 1, thumbnailUrl: null, available: true } })
    const intro = docs.video({ isStart: true, videoId: 18, video: { id: 18, name: 'Intro', durationSeconds: 1, thumbnailUrl: null, available: true } })
    const q = docs.question()
    intro.nextStepId = q.id
    q.answers[0].nextStepId = end.id
    q.answers[1].nextStepId = intro.id
    const loose = docs.question({ questionText: 'Los' })
    const { wrapper } = mountEditor(docs.doc(intro, q, end, loose), { component: OverviewList })
    const text = wrapper.text()
    expect(text).toContain('A. Ingrijpen')
    expect(text).toContain('B. Afwachten')
    expect(text).toContain('Einde')
    expect(text).toContain('Verder bij “Intro”')
    expect(wrapper.find('[data-test="unreachable"]').text()).toContain('Vraag: Los')
  })

  it('shows "Nog niet verbonden" for an open answer of a question that has next steps', () => {
    const v = docs.video()
    const q = docs.question({ isStart: true })
    q.answers[0].nextStepId = v.id
    const { wrapper } = mountEditor(docs.doc(q, v), { component: OverviewList })
    expect(wrapper.text()).toContain('Nog niet verbonden')
  })

  it('shows a question without next steps as an end, not as open answers', () => {
    const q = docs.question({ isStart: true })
    const { wrapper } = mountEditor(docs.doc(q), { component: OverviewList })
    expect(wrapper.text()).toContain('Einde')
    expect(wrapper.text()).not.toContain('Nog niet verbonden')
  })

  it('without a start says so and lists every step as unreachable', () => {
    const v = docs.video()
    const { wrapper } = mountEditor(docs.doc(v), { component: OverviewList })
    expect(wrapper.find('[data-test="no-start"]').text()).toBe('Nog geen startonderdeel.')
    expect(wrapper.find('[data-test="unreachable"]').exists()).toBe(true)
  })

  it('opens a step when clicked', async () => {
    const v = docs.video({ isStart: true })
    const { wrapper, ed } = mountEditor(docs.doc(v), { component: OverviewList })
    await wrapper.find('.step').trigger('click')
    expect(ed.selectedId).toBe(s(v.id))
  })
})

describe('Canvas ordenen (FR-025)', () => {
  it('puts a next step under its source, branches side by side, loose steps below', () => {
    const left = docs.video()
    const right = docs.video()
    const q = docs.question({ isStart: true, positionX: 500, positionY: 500 })
    q.answers[0].nextStepId = left.id
    q.answers[1].nextStepId = right.id
    const loose = docs.video()
    const { ed } = mountEditor(docs.doc(q, left, right, loose))
    autoLayout(ed.course)
    const node = (id) => findNode(ed.course, s(id))
    expect(node(left.id).y).toBeGreaterThan(node(q.id).y)
    expect(node(left.id).y).toBe(node(right.id).y)
    expect(node(left.id).x).not.toBe(node(right.id).x)
    expect(node(loose.id).y).toBeGreaterThan(node(left.id).y)
  })
})
