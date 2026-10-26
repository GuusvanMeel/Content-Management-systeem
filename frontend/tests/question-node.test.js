import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import NodeEditForm from '../src/editor/NodeEditForm.vue'
import QuestionNode from '../src/editor/QuestionNode.vue'
import { provideEditor } from '../src/editor/context'
import { addNode } from '../src/lib/course'
import { toEditor } from '../src/lib/courseMapping'
import { useCourseHistory } from '../src/lib/history'
import { editorStubs } from './editorStubs'

// Question steps: 2 to 4 answers, exactly one correct, optional feedback (specs/004 US3,
// FR-013, FR-017, FR-026).

const EMPTY = { id: 12, name: 'Redding', description: 'Diep bad', steps: [] }

let ed
let node

/** Mounts `component` for one new question step inside a provided editor. */
function mountWith(component) {
  const Harness = defineComponent({
    setup() {
      const initial = toEditor(EMPTY)
      const course = ref(initial.course)
      const history = useCourseHistory(() => course.value)
      ed = provideEditor({ course, stepVideos: initial.stepVideos, doc: EMPTY, history, save: async () => EMPTY })
      node = addNode(course.value, 'question', { x: 0, y: 0 })
      return () => h(component, { node: course.value.nodes[0] })
    },
  })
  return mount(Harness, { global: { stubs: editorStubs } })
}

const correctFlags = () => ed.course.nodes[0].answers.map((a) => a.correct)

describe('a new question step', () => {
  beforeEach(() => mountWith(NodeEditForm))

  it('has two empty answers, the first one correct, and no video', () => {
    const q = ed.course.nodes[0]
    expect(q.answers.map((a) => a.text)).toEqual(['', ''])
    expect(correctFlags()).toEqual([true, false])
    expect(q).not.toHaveProperty('videoId')
    expect(ed.course.startId).toBe(node.id)
  })
})

describe('answers in the edit form', () => {
  let wrapper
  beforeEach(() => {
    wrapper = mountWith(NodeEditForm)
  })

  it('adds answers up to 4', async () => {
    await wrapper.find('[data-test="add-answer"]').trigger('click')
    await wrapper.find('[data-test="add-answer"]').trigger('click')
    expect(wrapper.findAll('[data-test="answer"]')).toHaveLength(4)
    expect(wrapper.find('[data-test="add-answer"]').exists()).toBe(false)
  })

  it('removes answers down to 2, and the first one becomes correct when the correct one goes', async () => {
    await wrapper.find('[data-test="add-answer"]').trigger('click')
    await wrapper.findAll('input[type="radio"]')[2].trigger('change')
    expect(correctFlags()).toEqual([false, false, true])
    await wrapper.find('[aria-label="Antwoord C verwijderen"]').trigger('click')
    expect(correctFlags()).toEqual([true, false])
    expect(wrapper.find('[aria-label="Antwoord A verwijderen"]').exists()).toBe(false)
  })

  it('always keeps exactly one correct answer', async () => {
    await wrapper.findAll('input[type="radio"]')[1].trigger('change')
    expect(correctFlags()).toEqual([false, true])
  })

  it('cuts an answer at 255 characters', async () => {
    await wrapper.findAll('[data-test="answer"]')[0].setValue('a'.repeat(300))
    expect(ed.course.nodes[0].answers[0].text).toHaveLength(255)
  })

  it('has a question and a feedback field with counters of 1000', async () => {
    expect(wrapper.find('[data-test="question-counter"]').text()).toBe('1000 tekens over')
    expect(wrapper.find('[data-test="feedback-counter"]').text()).toBe('1000 tekens over')
    await wrapper.find('[data-test="feedback"]').setValue('Eerst alarmeren.')
    expect(ed.course.nodes[0].feedback).toBe('Eerst alarmeren.')
  })

  it('has a "Gaat naar…" choice per answer and no "Daarna" (specs/005 FR-021)', () => {
    expect(wrapper.text()).not.toContain('Daarna')
    expect(wrapper.findAll('[data-test="target"]')).toHaveLength(2)
  })
})

describe('the question block on the canvas', () => {
  it('shows "Nieuwe vraag", the letters and the correct answer, and Start', async () => {
    const wrapper = mountWith(QuestionNode)
    expect(wrapper.text()).toContain('Nieuwe vraag')
    expect(wrapper.text()).toContain('Start')
    expect(wrapper.findAll('.answers li').map((li) => li.find('.l').text())).toEqual(['A', 'B'])
    expect(wrapper.findAll('.answers li')[0].find('.ok').exists()).toBe(true)
    // specs/005 FR-019: one connection point per answer, plus the incoming one.
    expect(wrapper.findAll('.vue-flow__handle').map((h) => h.attributes('data-handle'))).toEqual(['in', ...ed.course.nodes[0].answers.map((a) => 'a-' + a.id)])
  })
})
