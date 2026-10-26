import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { provideEditor } from '../src/editor/context'
import { toEditor } from '../src/lib/courseMapping'
import { useCourseHistory } from '../src/lib/history'
import { editorStubs } from './editorStubs'

/**
 * Mounts a provided editor for `doc` (a draft document as the API returns it), optionally with a
 * component that gets `props(course)` as its props. Returns { wrapper, ed, history, save }.
 */
export function mountEditor(doc, { component = null, props = () => ({}), save = vi.fn() } = {}) {
  const harness = {}
  const Harness = defineComponent({
    setup() {
      const initial = toEditor(doc)
      const course = ref(initial.course)
      harness.history = useCourseHistory(() => course.value)
      harness.ed = provideEditor({ course, stepVideos: reactive(initial.stepVideos), doc, history: harness.history, save })
      return () => (component ? h(component, props(course.value)) : h('div'))
    },
  })
  harness.wrapper = mount(Harness, { global: { stubs: editorStubs } })
  harness.save = save
  return harness
}

/** Lets the history's 350 ms grouping pass (needs fake timers). */
export async function settle() {
  await nextTick()
  vi.advanceTimersByTime(400)
}

let nextId = 1000

/** Draft documents for tests: video(), question(), doc(). Ids are unique across a test file. */
export const docs = {
  video: (extra = {}) => ({
    id: ++nextId,
    stepType: 'video',
    isStart: false,
    positionX: 0,
    positionY: 0,
    videoId: 17,
    video: { id: 17, name: 'Zwembad', durationSeconds: 60, thumbnailUrl: '/t/17', available: true },
    nextStepId: null,
    ...extra,
  }),
  question: (extra = {}) => {
    const id = ++nextId
    return {
      id,
      stepType: 'question',
      isStart: false,
      positionX: 0,
      positionY: 0,
      questionText: 'Wat doe je?',
      feedback: null,
      answers: [
        { id: ++nextId, answerText: 'Ingrijpen', isCorrect: true, nextStepId: null },
        { id: ++nextId, answerText: 'Afwachten', isCorrect: false, nextStepId: null },
      ],
      ...extra,
    }
  },
  doc: (...steps) => ({ id: 12, name: 'Redding', description: 'Diep bad', steps }),
}

/** The editor key of a step or answer id. */
export const s = (id) => `s${id}`
export const a = (id) => `a${id}`
