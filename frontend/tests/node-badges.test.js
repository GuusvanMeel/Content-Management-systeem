import { describe, expect, it } from 'vitest'
import QuestionNode from '../src/editor/QuestionNode.vue'
import VideoNode from '../src/editor/VideoNode.vue'
import { a, docs, mountEditor, s } from './editorHarness'

// Start, end, incoming connections and the message dot on a block (specs/005 US3, FR-022).

const mountBlock = (doc, index, component) =>
  mountEditor(doc, { component, props: (course) => ({ node: course.nodes[index] }) })

describe('end (FR-005)', () => {
  it('a video without a next step is an end, with a next step it is not', async () => {
    const v2 = docs.video()
    const v1 = docs.video({ isStart: true })
    const { wrapper, ed } = mountBlock(docs.doc(v1, v2), 0, VideoNode)
    expect(wrapper.find('[data-test="end"]').exists()).toBe(true)
    ed.connect(s(v1.id), 'next', s(v2.id))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="end"]').exists()).toBe(false)
  })

  it('a question is an end while no answer continues', async () => {
    const v = docs.video()
    const q = docs.question({ isStart: true })
    const { wrapper, ed } = mountBlock(docs.doc(q, v), 0, QuestionNode)
    expect(wrapper.find('[data-test="end"]').exists()).toBe(true)
    ed.connect(s(q.id), 'a-' + a(q.answers[0].id), s(v.id))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="end"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="issue"]').text()).toBe('Antwoord B is nog niet verbonden')
  })
})

describe('incoming connections and start (verbeterronde 005, punt 5)', () => {
  it('shows the number of incoming connections only as a tooltip, and Start', async () => {
    const target = docs.video()
    const q = docs.question({ isStart: true })
    q.answers[0].nextStepId = target.id
    const { wrapper, ed } = mountBlock(docs.doc(target, q), 0, VideoNode)
    const block = () => wrapper.find('[data-test="block"]')
    expect(block().attributes('title')).toBe('Wordt bereikt vanuit 1 verbinding')
    ed.connect(s(q.id), 'a-' + a(q.answers[1].id), s(target.id))
    await wrapper.vm.$nextTick()
    expect(block().attributes('title')).toBe('Wordt bereikt vanuit 2 verbindingen')
    expect(wrapper.text()).not.toContain('← 2')
    ed.disconnect(s(q.id), 'a-' + a(q.answers[0].id))
    ed.disconnect(s(q.id), 'a-' + a(q.answers[1].id))
    await wrapper.vm.$nextTick()
    expect(block().attributes('title')).toBeUndefined()
    const start = mountBlock(docs.doc(docs.video({ isStart: true })), 0, VideoNode)
    expect(start.wrapper.text()).toContain('Start')
  })
})

describe('the message dot (FR-022, FR-022a)', () => {
  it('is orange with the first message, red after saving, absent when complete', async () => {
    const v = docs.video({ isStart: true, videoId: null, video: null })
    const save = async () => docs.doc(v)
    const { wrapper, ed } = mountEditor(docs.doc(v), { component: VideoNode, props: (course) => ({ node: course.nodes[0] }), save })
    const dot = () => wrapper.find('[data-test="issue"]')
    expect(dot().text()).toBe('Kies een video')
    expect(dot().classes()).not.toContain('flagged')
    ed.course.name = 'X'
    await ed.saveDraft()
    await wrapper.vm.$nextTick()
    expect(dot().classes()).toContain('flagged')
    const complete = mountBlock(docs.doc(docs.video({ isStart: true })), 0, VideoNode)
    expect(complete.wrapper.find('[data-test="issue"]').exists()).toBe(false)
  })
})
