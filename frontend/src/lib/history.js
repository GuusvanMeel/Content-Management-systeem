import { ref, watch, computed } from 'vue'

// Undo/redo for a course: snapshots of its editable content, grouped with a short debounce
// so typing a sentence is one undo step.
export function useCourseHistory(getCourse) {
  const stack = ref([])
  const index = ref(-1)
  const snap = (c) => JSON.stringify({ name: c.name, description: c.description, startId: c.startId, nodes: c.nodes })
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
    const c = getCourse()
    if (c && stack.value.length > 1) c.updatedAt = Date.now()
  }

  const c0 = getCourse()
  if (c0) commit(snap(c0))

  const stop = watch(
    () => (getCourse() ? snap(getCourse()) : null),
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
    apply(stack.value[index.value])
  }
  function redo() {
    flush()
    if (index.value >= stack.value.length - 1) return
    index.value++
    apply(stack.value[index.value])
  }
  return {
    undo, redo, stop,
    canUndo: computed(() => index.value > 0 || !!pending),
    canRedo: computed(() => index.value < stack.value.length - 1),
  }
}
