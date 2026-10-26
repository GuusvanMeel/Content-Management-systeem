import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ConnectMenu from '../src/editor/ConnectMenu.vue'
import NodeEditForm from '../src/editor/NodeEditForm.vue'
import { useEditor } from '../src/editor/context'
import { findNode, outgoing } from '../src/lib/course'
import { toEditor } from '../src/lib/courseMapping'
import { ui } from '../src/lib/ui'
import { a, docs, mountEditor, s, settle } from './editorHarness'

// Connecting steps in the editor (specs/005 US1, US4, US6; FR-001 – FR-007, FR-020, FR-021, SC-007).

beforeEach(() => {
  vi.useFakeTimers()
  ui.confirm = null
})
afterEach(() => {
  vi.useRealTimers()
})

/** A route snapshot: every step with its outgoing targets. */
const routeOf = (course) => course.nodes.map((n) => [n.id, outgoing(n).map((o) => o.target)])

describe('connecting (US1, FR-001 – FR-003)', () => {
  let ed
  let v1
  let v2
  let q

  beforeEach(() => {
    v1 = docs.video({ isStart: true })
    v2 = docs.video()
    q = docs.question()
    ;({ ed } = mountEditor(docs.doc(v1, v2, q)))
  })

  it('connects a video to one next step, and a new connection replaces the old one', () => {
    expect(ed.connect(s(v1.id), 'next', s(v2.id))).toBe(true)
    expect(findNode(ed.course, s(v1.id)).next).toBe(s(v2.id))
    ed.connect(s(v1.id), 'next', s(q.id))
    expect(findNode(ed.course, s(v1.id)).next).toBe(s(q.id))
  })

  it('refuses a video that points to itself', () => {
    expect(ed.connect(s(v1.id), 'next', s(v1.id))).toBe(false)
    expect(findNode(ed.course, s(v1.id)).next).toBeNull()
  })

  it('connects each answer on its own, also two answers to one step and an answer to its own question', () => {
    const [A, B] = q.answers.map((x) => 'a-' + a(x.id))
    ed.connect(s(q.id), A, s(v2.id))
    ed.connect(s(q.id), B, s(q.id))
    expect(findNode(ed.course, s(q.id)).answers.map((x) => x.target)).toEqual([s(v2.id), s(q.id)])
    ed.connect(s(q.id), B, s(v2.id))
    expect(findNode(ed.course, s(q.id)).answers.map((x) => x.target)).toEqual([s(v2.id), s(v2.id)])
  })

  it('removes a connection', () => {
    ed.connect(s(v1.id), 'next', s(v2.id))
    ed.disconnect(s(v1.id), 'next')
    expect(findNode(ed.course, s(v1.id)).next).toBeNull()
  })

  it('sends connections as keys, and keeps them after saving', async () => {
    const saved = docs.doc(
      { ...v1, nextStepId: q.id },
      v2,
      { ...q, answers: [{ ...q.answers[0], nextStepId: v2.id }, q.answers[1]] },
    )
    const save = vi.fn().mockResolvedValue(saved)
    const harness = mountEditor(docs.doc(v1, v2, q), { save })
    harness.ed.connect(s(v1.id), 'next', s(q.id))
    harness.ed.connect(s(q.id), 'a-' + a(q.answers[0].id), s(v2.id))
    await settle()
    await harness.ed.saveDraft()
    const payload = save.mock.calls[0][0]
    expect(payload.steps[0]).toMatchObject({ key: s(v1.id), nextStepKey: s(q.id) })
    expect(payload.steps[2].answers.map((x) => x.nextStepKey)).toEqual([s(v2.id), null])
    expect(routeOf(harness.ed.course)).toEqual(routeOf(toEditor(saved).course))
    expect(harness.ed.dirty).toBe(false)
  })
})

describe('"Daarna" and "Gaat naar…" (FR-021)', () => {
  function mountForm(step, others) {
    const harness = mountEditor(docs.doc(step, ...others), {
      component: NodeEditForm,
      props: (course) => ({ node: course.nodes[0] }),
    })
    return harness
  }

  it('offers every step but the video itself, plus "Geen volgend onderdeel (einde)"', async () => {
    const v1 = docs.video({ isStart: true })
    const v2 = docs.video()
    const { wrapper, ed } = mountForm(v1, [v2])
    const select = wrapper.find('[data-test="next"]')
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Geen volgend onderdeel (einde)', 'Zwembad'])
    await select.setValue(s(v2.id))
    expect(ed.course.nodes[0].next).toBe(s(v2.id))
    await select.setValue('')
    expect(ed.course.nodes[0].next).toBeNull()
  })

  it('offers the question itself per answer', () => {
    const q = docs.question({ isStart: true })
    const { wrapper } = mountForm(q, [])
    const options = wrapper.findAll('[data-test="target"]')[0].findAll('option').map((o) => o.text())
    expect(options).toEqual(['Gaat naar… (geen volgend onderdeel)', '→ Vraag: Wat doe je?'])
  })
})

describe('a connected new step from a connection point (US4, FR-020)', () => {
  it('places a new video under the source and connects it', () => {
    const v1 = docs.video({ isStart: true })
    const { ed } = mountEditor(docs.doc(v1))
    const created = ed.addLinked(s(v1.id), 'next', 'video')
    expect(findNode(ed.course, s(v1.id)).next).toBe(created.id)
    expect(created.y).toBeGreaterThan(v1.positionY)
  })

  it('puts the steps of different answers side by side', () => {
    const q = docs.question({ isStart: true })
    const { ed } = mountEditor(docs.doc(q))
    const left = ed.addLinked(s(q.id), 'a-' + a(q.answers[0].id), 'video')
    const right = ed.addLinked(s(q.id), 'a-' + a(q.answers[1].id), 'video')
    expect(left.x).toBeLessThan(right.x)
    expect(left.y).toBe(right.y)
  })

  it('inserts a new video between a source and its old next step', () => {
    const v2 = docs.video()
    const v1 = docs.video({ isStart: true, nextStepId: v2.id })
    const { ed } = mountEditor(docs.doc(v1, v2))
    const middle = ed.addLinked(s(v1.id), 'next', 'video')
    expect(findNode(ed.course, s(v1.id)).next).toBe(middle.id)
    expect(middle.next).toBe(s(v2.id))
  })

  it('inserts a new question with its correct answer to the old next step (clarify Q2)', () => {
    const v2 = docs.video()
    const v1 = docs.video({ isStart: true, nextStepId: v2.id })
    const { ed } = mountEditor(docs.doc(v1, v2))
    const middle = ed.addLinked(s(v1.id), 'next', 'question')
    expect(findNode(ed.course, s(v1.id)).next).toBe(middle.id)
    expect(middle.answers.map((x) => [x.correct, x.target])).toEqual([
      [true, s(v2.id)],
      [false, null],
    ])
    expect(ed.issues.issues.map((i) => i.msg)).toContain('Antwoord B is nog niet verbonden')
  })
})

describe('the connect menu (FR-020)', () => {
  function mountMenu(nodes, sourceIndex, handle) {
    const emitted = {}
    const harness = mountEditor(docs.doc(...nodes), {
      component: defineComponent({
        setup() {
          const ed = useEditor()
          return () =>
            h(ConnectMenu, {
              sourceId: ed.course.nodes[sourceIndex].id,
              handle: handle(ed.course.nodes[sourceIndex]),
              onCreate: (t) => (emitted.create = t),
              onChoose: (t) => (emitted.choose = t),
              onRemove: () => (emitted.remove = true),
              onClose: () => (emitted.close = true),
            })
        },
      }),
    })
    return { ...harness, emitted }
  }

  it('offers new steps and the existing steps without the video itself', async () => {
    const v1 = docs.video({ isStart: true })
    const v2 = docs.video()
    const { wrapper, emitted } = mountMenu([v1, v2], 0, () => 'next')
    expect(wrapper.find('[data-test="new-video"]').text()).toBe('Nieuw video-onderdeel')
    expect(wrapper.find('[data-test="new-question"]').text()).toBe('Nieuwe vraag')
    expect(wrapper.findAll('[data-test="existing"]')).toHaveLength(1)
    expect(wrapper.find('[data-test="remove-connection"]').exists()).toBe(false)
    await wrapper.find('[data-test="new-question"]').trigger('click')
    expect(emitted.create).toBe('question')
    await wrapper.find('[data-test="existing"]').trigger('click')
    expect(emitted.choose).toBe(s(v2.id))
  })

  it('offers "Verbinding weghalen" only when the point is connected', async () => {
    const v2 = docs.video()
    const v1 = docs.video({ isStart: true, nextStepId: v2.id })
    const { wrapper, emitted } = mountMenu([v1, v2], 0, () => 'next')
    await wrapper.find('[data-test="remove-connection"]').trigger('click')
    expect(emitted.remove).toBe(true)
  })

  it('shows a search field above 8 steps and filters', async () => {
    const start = docs.video({ isStart: true })
    const questions = Array.from({ length: 9 }, (_, i) => docs.question({ questionText: `Vraag ${i}` }))
    const { wrapper } = mountMenu([start, ...questions], 0, () => 'next')
    const search = wrapper.find('[data-test="search"]')
    expect(search.exists()).toBe(true)
    await search.setValue('Vraag 3')
    expect(wrapper.findAll('[data-test="existing"]').map((b) => b.text())).toEqual(['Vraag: Vraag 3'])
  })

  it('closes on Escape without a change', async () => {
    const v1 = docs.video({ isStart: true })
    const { emitted, ed } = mountMenu([v1], 0, () => 'next')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(emitted.close).toBe(true)
    expect(ed.course.nodes[0].next).toBeNull()
  })
})

describe('deleting a step (US6, FR-006, SC-007)', () => {
  it('clears every connection to the step and reports what is missing; undo restores the route', async () => {
    const c = docs.video()
    const b = docs.video({ nextStepId: c.id })
    const q = docs.question({ isStart: true })
    q.answers = q.answers.map((x) => ({ ...x, nextStepId: b.id }))
    const { ed, history } = mountEditor(docs.doc(q, b, c))
    const before = routeOf(ed.course)
    expect(await ed.removeNode(s(b.id))).toBe(true)
    expect(findNode(ed.course, s(q.id)).answers.map((x) => x.target)).toEqual([null, null])
    // The question is now an end; C cannot be reached.
    expect(ed.issues.issues.map((i) => [i.code, i.nodeId])).toEqual([['unreachable', s(c.id)]])
    await settle()
    history.undo()
    await nextTick()
    expect(routeOf(ed.course)).toEqual(before)
  })

  it('restores the route after undo even when the removal was saved in between', async () => {
    const b = docs.video()
    const v1 = docs.video({ isStart: true, nextStepId: b.id })
    const save = vi.fn().mockResolvedValueOnce(docs.doc({ ...v1, nextStepId: null }))
    const { ed, history } = mountEditor(docs.doc(v1, b), { save })
    const before = routeOf(ed.course)
    await ed.removeNode(s(b.id))
    await settle()
    await ed.saveDraft()
    history.undo()
    await nextTick()
    expect(routeOf(ed.course)).toEqual(before)
    // The restored step is new again for the server, and the connection goes by key.
    save.mockResolvedValueOnce(docs.doc(v1, b))
    await ed.saveDraft()
    const payload = save.mock.calls[1][0]
    expect(payload.steps[1]).not.toHaveProperty('id')
    expect(payload.steps[0].nextStepKey).toBe(payload.steps[1].key)
  })

  it('leaves only "Kies een startonderdeel" when the start step is removed', async () => {
    const v1 = docs.video({ isStart: true })
    const v2 = docs.video()
    const { ed } = mountEditor(docs.doc(v1, v2))
    await ed.removeNode(s(v1.id))
    expect(ed.issues.issues.map((i) => i.code)).toEqual(['noStart'])
  })

  it('keeps the connections of a restored step whose video can no longer be picked (specs/004 FR-020d)', async () => {
    const end = docs.video()
    const gone = docs.video({ isStart: true, videoId: 9, video: { id: 9, name: 'Weg', durationSeconds: 1, thumbnailUrl: null, available: false }, nextStepId: end.id })
    const save = vi.fn().mockResolvedValueOnce(docs.doc(end))
    const { ed, history } = mountEditor(docs.doc(gone, end), { save })
    const removing = ed.removeNode(s(gone.id))
    await nextTick()
    ui.confirm.resolve(true)
    await removing
    await settle()
    await ed.saveDraft()
    history.undo()
    await nextTick()
    expect(findNode(ed.course, s(gone.id))).toMatchObject({ videoId: null, next: s(end.id) })
  })
})
