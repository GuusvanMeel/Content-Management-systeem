import { ref, watch, computed } from 'vue'
import { applyKeyChanges } from './courseMapping'

/** The editable content of a course as JSON; canvas positions count as content (specs/004 FR-009). */
export const snapCourse = (c) => JSON.stringify({ name: c.name, description: c.description, startId: c.startId, nodes: c.nodes })

// Undo/redo for a course: snapshots of its editable content, grouped with a short debounce
// so typing a sentence is one undo step. Only the editor's copy changes; nothing is saved until
// "Opslaan als concept" (specs/004 FR-020a).
export function useCourseHistory(getCourse) {
  const stack = ref([])
  const index = ref(-1)
  let timer = null
  let pending = null

  const commit = (json) => {
    timer = null
    pending = null
    if (json === stack.value[index.value]) return
    stack.value = stack.value.slice(0, index.value + 1)
    stack.value.push(json)
    if (stack.value.length > 150) stack.value.shift()
    index.value = stack.value.length - 1
  }

  const c0 = getCourse()
  if (c0) commit(snapCourse(c0))

  const stop = watch(
    () => (getCourse() ? snapCourse(getCourse()) : null),
    (json) => {
      if (json == null) return
      pending = json
      clearTimeout(timer)
      timer = setTimeout(() => commit(json), 350)
    },
  )

  const flush = () => {
    if (pending) {
      clearTimeout(timer)
      commit(pending)
    }
  }
  // Optional clean-up of a snapshot before undo/redo applies it (specs/004 FR-020d). The cleaned
  // snapshot replaces the stored one, so no extra step is added and redo keeps working.
  let transform = null
  const restore = (i) => {
    let json = stack.value[i]
    if (transform) {
      json = JSON.stringify(transform(JSON.parse(json)))
      stack.value[i] = json
    }
    apply(json)
  }
  const apply = (json) => {
    const d = JSON.parse(json)
    const c = getCourse()
    c.name = d.name
    c.description = d.description
    c.startId = d.startId
    c.nodes = d.nodes
  }
  function undo() {
    flush()
    if (index.value <= 0) return
    index.value--
    restore(index.value)
  }
  function redo() {
    flush()
    if (index.value >= stack.value.length - 1) return
    index.value++
    restore(index.value)
  }
  /**
   * After a save: replaces temporary keys by the new saved keys in every step of the history, so
   * undo after saving refers to the saved steps (research R10). `changes` maps old → new key.
   */
  function replaceKeys(changes) {
    flush()
    stack.value = stack.value.map((json) => JSON.stringify(applyKeyChanges(JSON.parse(json), changes)))
  }
  return {
    undo, redo, stop, flush, replaceKeys,
    setTransform: (fn) => (transform = fn),
    canUndo: computed(() => index.value > 0 || !!pending),
    canRedo: computed(() => index.value < stack.value.length - 1),
  }
}
