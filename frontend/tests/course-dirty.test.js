import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { provideEditor } from '../src/editor/context'
import { toEditor } from '../src/lib/courseMapping'
import { useCourseHistory } from '../src/lib/history'

// Unsaved changes, undo and saving in the editor (specs/004 FR-009, FR-020a, research R10).

const doc = {
  id: 12,
  name: 'Redding',
  description: 'Diep bad',
  steps: [
    {
      id: 103,
      stepType: 'question',
      isStart: true,
      positionX: 0,
      positionY: 0,
      questionText: 'Wat doe je eerst?',
      feedback: null,
      answers: [
        { id: 501, answerText: 'Alarmeren', isCorrect: true },
        { id: 502, answerText: 'Springen', isCorrect: false },
      ],
    },
  ],
}

let ed
let history
let save

/** Mounts a tiny component that provides the editor, the way CourseEditor.vue does. */
function mountEditor(source = doc) {
  const initial = toEditor(source)
  const Harness = defineComponent({
    setup() {
      const course = ref(initial.course)
      history = useCourseHistory(() => course.value)
      ed = provideEditor({ course, stepVideos: reactive(initial.stepVideos), doc: source, history, save })
      return () => h('div')
    },
  })
  return mount(Harness)
}

/** Lets the history's 350 ms grouping pass. */
async function settle() {
  await nextTick()
  vi.advanceTimersByTime(400)
}

beforeEach(() => {
  vi.useFakeTimers()
  save = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('unsaved changes', () => {
  it('has none right after loading', () => {
    mountEditor()
    expect(ed.dirty).toBe(false)
  })

  it('has some after changing a question, and none after undoing it', async () => {
    mountEditor()
    ed.course.nodes[0].question = 'Wat doe je nu?'
    await settle()
    expect(ed.dirty).toBe(true)
    history.undo()
    await nextTick()
    expect(ed.course.nodes[0].question).toBe('Wat doe je eerst?')
    expect(ed.dirty).toBe(false)
  })

  it('counts moving a block as a change', async () => {
    mountEditor()
    ed.course.nodes[0].x = 40
    await settle()
    expect(ed.dirty).toBe(true)
  })
})

describe('saving', () => {
  it('sends the payload, takes over the new keys and is clean afterwards', async () => {
    mountEditor()
    const added = ed.addNode('video', { x: 0, y: 300 })
    await settle()
    save.mockResolvedValue({
      ...doc,
      steps: [...doc.steps, { id: 104, stepType: 'video', isStart: false, positionX: 0, positionY: 300, videoId: null, video: null }],
    })
    expect(await ed.saveDraft()).toBe(true)
    const payload = save.mock.calls[0][0]
    expect(payload.steps[0].id).toBe(103)
    expect(payload.steps[1]).not.toHaveProperty('id')
    expect(ed.course.nodes.map((n) => n.id)).toEqual(['s103', 's104'])
    expect(added.id).toBe('s104')
    expect(ed.dirty).toBe(false)
  })

  it('replaces the keys in the history too, so undo after saving uses the saved steps', async () => {
    mountEditor()
    ed.addNode('video', { x: 0, y: 300 })
    await settle()
    ed.course.nodes[1].x = 50
    await settle()
    save.mockResolvedValue({
      ...doc,
      steps: [...doc.steps, { id: 104, stepType: 'video', isStart: false, positionX: 50, positionY: 300, videoId: null, video: null }],
    })
    await ed.saveDraft()
    history.undo()
    await nextTick()
    expect(ed.course.nodes[1]).toMatchObject({ id: 's104', x: 0 })
    expect(ed.dirty).toBe(true)
  })

  it('sends a step that was restored after its removal was saved as a new step', async () => {
    mountEditor()
    ed.removeNode('s103')
    await settle()
    save.mockResolvedValueOnce({ ...doc, steps: [] })
    await ed.saveDraft()
    history.undo()
    await nextTick()
    expect(ed.course.nodes.map((n) => n.id)).toEqual(['s103'])
    save.mockResolvedValueOnce(doc)
    await ed.saveDraft()
    const payload = save.mock.calls[1][0]
    expect(payload.steps[0]).not.toHaveProperty('id')
    expect(payload.steps[0].answers.every((a) => !('id' in a))).toBe(true)
  })

  it('keeps the changes and stays unsaved when saving fails', async () => {
    mountEditor()
    ed.course.name = 'Nieuwe naam'
    await settle()
    save.mockRejectedValue(Object.assign(new Error('Netwerkfout'), { status: 0 }))
    expect(await ed.saveDraft()).toBe(false)
    await flushPromises()
    expect(ed.course.name).toBe('Nieuwe naam')
    expect(ed.dirty).toBe(true)
  })

  it('marks the fields of a validation error', async () => {
    mountEditor()
    ed.course.name = ''
    await settle()
    save.mockRejectedValue(Object.assign(new Error('Controleer de ingevulde gegevens.'), { status: 400, code: 'validation_failed', fields: { name: 'Vul een naam en een beschrijving in.' } }))
    await ed.saveDraft()
    expect(ed.fieldErrors).toEqual({ name: 'Vul een naam en een beschrijving in.' })
  })
})
