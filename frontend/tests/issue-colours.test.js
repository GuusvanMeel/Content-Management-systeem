import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CompletenessStatus from '../src/editor/CompletenessStatus.vue'
import { a, docs, mountEditor, s, settle } from './editorHarness'

// Orange "nog te doen" that turns red at a click on "Opslaan als concept" (specs/005 FR-022a, FR-023).

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** A start question whose answer A leads to a video and answer B is still open. */
function openRoute() {
  const v = docs.video()
  const q = docs.question({ isStart: true })
  q.answers[0].nextStepId = v.id
  return { q, v, doc: docs.doc(q, v) }
}

describe('colours of messages', () => {
  it('starts orange, turns red at saving, and the draft is saved anyway', async () => {
    const { q, doc } = openRoute()
    const save = vi.fn().mockResolvedValue(doc)
    const { ed } = mountEditor(doc, { save })
    const [issue] = ed.issues.issues
    expect(issue.msg).toBe('Antwoord B is nog niet verbonden')
    expect(ed.isFlagged(issue)).toBe(false)
    ed.course.name = 'Andere naam'
    await settle()
    expect(await ed.saveDraft()).toBe(true)
    expect(save).toHaveBeenCalled()
    expect(ed.isFlagged(ed.issues.issues[0])).toBe(true)
    expect(ed.issues.issues[0].id).toBe(`answerOpen:${s(q.id)}:${a(q.answers[1].id)}`)
  })

  it('turns red also when saving fails', async () => {
    const { doc } = openRoute()
    const save = vi.fn().mockRejectedValue(Object.assign(new Error('Netwerkfout'), { status: 0 }))
    const { ed } = mountEditor(doc, { save })
    ed.course.name = 'Andere naam'
    await settle()
    expect(await ed.saveDraft()).toBe(false)
    expect(ed.isFlagged(ed.issues.issues[0])).toBe(true)
  })

  it('starts a message that appears after saving orange, and drops a solved one', async () => {
    const { q, v, doc } = openRoute()
    const save = vi.fn().mockResolvedValue(doc)
    const { ed } = mountEditor(doc, { save })
    ed.course.name = 'X'
    await settle()
    await ed.saveDraft()
    // New problem: empty question.
    ed.course.nodes[0].question = ''
    await nextTick()
    const newer = ed.issues.issues.find((i) => i.code === 'noQuestion')
    expect(ed.isFlagged(newer)).toBe(false)
    // Solve the red one.
    ed.connect(s(q.id), 'a-' + a(q.answers[1].id), s(v.id))
    await nextTick()
    expect(ed.issues.issues.map((i) => i.code)).toEqual(['noQuestion'])
  })

  it('keeps red messages red when the keys change at saving', async () => {
    const v = docs.video({ isStart: true })
    const doc = docs.doc(v)
    const save = vi.fn()
    const { ed } = mountEditor(doc, { save })
    // A new open question: its key is temporary until saved.
    const created = ed.addLinked(s(v.id), 'next', 'question')
    ed.connect(created.id, 'a-' + created.answers[0].id, s(v.id))
    await settle()
    const savedQuestion = docs.question()
    savedQuestion.answers[0].nextStepId = v.id
    save.mockResolvedValue(docs.doc({ ...v, nextStepId: savedQuestion.id }, savedQuestion))
    await ed.saveDraft()
    const open = ed.issues.issues.find((i) => i.code === 'answerOpen')
    expect(open.nodeId).toBe(s(savedQuestion.id))
    expect(ed.isFlagged(open)).toBe(true)
  })
})

describe('the status in the bar (FR-023)', () => {
  it('shows "n nog te doen" in orange, red after saving, with a list that opens the step', async () => {
    const { q, doc } = openRoute()
    const save = vi.fn().mockResolvedValue(doc)
    const { ed, wrapper } = mountEditor(doc, { component: CompletenessStatus, save })
    const button = () => wrapper.find('[data-test="todo"]')
    expect(button().text()).toBe('1 nog te doen')
    expect(button().classes()).not.toContain('flagged')
    ed.course.name = 'X'
    await settle()
    await ed.saveDraft()
    await flushPromises()
    expect(button().classes()).toContain('flagged')
    await button().trigger('click')
    await wrapper.find('[data-test="todo-item"]').trigger('click')
    expect(ed.selectedId).toBe(s(q.id))
  })

  it('shows "Cursus is compleet" without messages', () => {
    const v = docs.video({ isStart: true })
    const { wrapper } = mountEditor(docs.doc(v), { component: CompletenessStatus })
    expect(wrapper.find('[data-test="complete"]').text()).toBe('Cursus is compleet')
  })

  it('brings the whole canvas into view for a course-level message', async () => {
    const v = docs.video()
    const { ed, wrapper } = mountEditor(docs.doc(v), { component: CompletenessStatus })
    await wrapper.find('[data-test="todo"]').trigger('click')
    await wrapper.find('[data-test="todo-item"]').trigger('click')
    expect(ed.focusRequest).toMatchObject({ id: null })
  })
})
