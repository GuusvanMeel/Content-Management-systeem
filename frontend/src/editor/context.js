// Shared editor state for the three editor variants.
import { ref, computed, inject, provide, reactive, watch } from 'vue'
import * as C from '../lib/course'
import { toast } from '../lib/ui'

const KEY = Symbol('editor')

export function provideEditor({ app, course, history }) {
  const selectedId = ref(null)
  const selectedEdge = ref(null)
  const modalId = ref(null) // variant "Canvas": the part open in the dialog
  const focusRequest = ref(null) // { id, t } – the canvas centres on this part
  const showSettings = ref(false)
  const lastCanvas = ref(app.editorVariant === 'list' ? 'inspector' : app.editorVariant)
  watch(
    () => app.editorVariant,
    (v) => v !== 'list' && (lastCanvas.value = v),
  )

  const validation = computed(() => app.validation(course.value))
  const ordered = computed(() => C.orderedNodes(course.value))

  function select(id) {
    selectedId.value = id
    selectedEdge.value = null
  }
  function selectEdge(id) {
    selectedEdge.value = id
    selectedId.value = null
  }
  function clearSelection() {
    selectedId.value = null
    selectedEdge.value = null
  }
  /** Show a part for editing, whatever the current variant. */
  function open(id) {
    if (app.editorVariant === 'list') app.editorVariant = lastCanvas.value
    select(id)
    if (app.editorVariant === 'popover') modalId.value = id
    focusRequest.value = { id, t: Date.now() }
  }
  function focusIssue(issue) {
    if (issue.nodeId) open(issue.nodeId)
    else showSettings.value = true
  }

  function freeSpot() {
    const nodes = course.value.nodes
    if (!nodes.length) return { x: 0, y: 0 }
    const maxX = Math.max(...nodes.map((n) => n.x + C.NODE_W[n.type]))
    return { x: maxX + 60, y: Math.min(...nodes.map((n) => n.y)) }
  }
  const addNode = (type, pos, extra) => C.addNode(course.value, type, pos ?? freeSpot(), extra)
  const addLinked = (sourceId, handle, type, pos) => C.addLinkedNode(course.value, sourceId, handle, type, pos)
  const connect = (source, handle, target) => C.connect(course.value, source, handle, target)
  const disconnect = (source, handle) => C.disconnect(course.value, source, handle)
  const setStart = (id) => (course.value.startId = id)

  function removeNode(id) {
    C.deleteNode(course.value, id)
    if (selectedId.value === id) selectedId.value = null
    if (modalId.value === id) modalId.value = null
    toast('Onderdeel verwijderd', { actionLabel: 'Ongedaan maken', action: () => history.undo() })
  }

  const ctx = reactive({
    app, course, history, validation, ordered,
    selectedId, selectedEdge, modalId, focusRequest, showSettings,
    select, selectEdge, clearSelection, open, focusIssue,
    addNode, addLinked, connect, disconnect, removeNode, setStart,
  })
  provide(KEY, ctx)
  return ctx
}

export const useEditor = () => inject(KEY)
