// Shared editor state for the three editor variants. The editor works on a local copy of the
// draft; nothing is stored until "Opslaan als concept" (specs/004 FR-009, research R10).
import { ref, computed, inject, provide, reactive, watch } from 'vue'
import * as C from '../lib/course'
import { applyKeyChanges, keyChanges, savedKeys, toEditor, toPayload } from '../lib/courseMapping'
import { snapCourse } from '../lib/history'
import { getEditorVariant, setEditorVariant } from '../lib/editorPreference'
import { toast } from '../lib/ui'

const KEY = Symbol('editor')

/**
 * `course` is a ref with the editor model, `stepVideos` a reactive map videoId → video details,
 * `doc` the draft document the course was loaded from, `save(payload)` stores a draft and returns
 * the saved document.
 */
export function provideEditor({ course, stepVideos: initialVideos, doc, history, save }) {
  const stepVideos = reactive(initialVideos)
  const selectedId = ref(null)
  const modalId = ref(null) // variant "Canvas": the part open in the dialog
  const focusRequest = ref(null) // { id, t } – the canvas centres on this part
  const showSettings = ref(false)
  const variant = ref(getEditorVariant())
  const lastCanvas = ref(variant.value === 'list' ? 'inspector' : variant.value)
  watch(variant, (v) => {
    setEditorVariant(v)
    if (v !== 'list') lastCanvas.value = v
  })

  // What was last saved: its snapshot (for "unsaved changes") and its keys (for the payload).
  const savedSnapshot = ref(snapCourse(course.value))
  let saved = savedKeys(doc)
  const dirty = computed(() => snapCourse(course.value) !== savedSnapshot.value)
  const saving = ref(false)
  const fieldErrors = ref({})

  const ordered = computed(() => C.orderedNodes(course.value))

  function select(id) {
    selectedId.value = id
  }
  function clearSelection() {
    selectedId.value = null
  }
  /** Show a part for editing, whatever the current variant. */
  function open(id) {
    if (variant.value === 'list') variant.value = lastCanvas.value
    select(id)
    if (variant.value === 'popover') modalId.value = id
    focusRequest.value = { id, t: Date.now() }
  }

  function freeSpot() {
    const nodes = course.value.nodes
    if (!nodes.length) return { x: 0, y: 0 }
    const maxX = Math.max(...nodes.map((n) => n.x + C.NODE_W[n.type]))
    return { x: maxX + 60, y: Math.min(...nodes.map((n) => n.y)) }
  }
  const addNode = (type, pos) => C.addNode(course.value, type, pos ?? freeSpot())
  const setStart = (id) => (course.value.startId = id)

  function removeNode(id) {
    C.deleteNode(course.value, id)
    if (selectedId.value === id) selectedId.value = null
    if (modalId.value === id) modalId.value = null
    toast('Onderdeel verwijderd', { actionLabel: 'Ongedaan maken', action: () => history.undo() })
  }

  /** Remembers the details of a video picked from the library (always available). */
  function rememberVideo(video) {
    stepVideos[video.id] = {
      name: video.name,
      durationSeconds: video.durationSeconds,
      thumbnailUrl: video.thumbnailUrl,
      available: true,
    }
  }

  /** "Opslaan als concept". Returns true when saved. */
  async function saveDraft() {
    history.flush()
    saving.value = true
    fieldErrors.value = {}
    const sent = JSON.parse(snapCourse(course.value))
    try {
      const result = await save(toPayload(course.value, saved))
      // Keep the editor's own keys stable: map the keys that were sent to the saved ones.
      const changes = keyChanges(sent, result, saved)
      history.replaceKeys(changes)
      applyKeyChanges(course.value, changes)
      if (changes[selectedId.value]) selectedId.value = changes[selectedId.value]
      if (changes[modalId.value]) modalId.value = changes[modalId.value]
      Object.assign(stepVideos, toEditor(result).stepVideos)
      saved = savedKeys(result)
      // What was sent, with the new keys, is what is stored now; later edits stay unsaved.
      savedSnapshot.value = JSON.stringify(applyKeyChanges(sent, changes))
      return true
    } catch (error) {
      if (error.code === 'validation_failed') fieldErrors.value = error.fields ?? {}
      if (error.status !== 401) toast('De cursus is niet opgeslagen. Probeer het opnieuw.')
      return false
    } finally {
      saving.value = false
    }
  }

  const ctx = reactive({
    course, stepVideos, history, ordered, variant,
    selectedId, modalId, focusRequest, showSettings,
    dirty, saving, fieldErrors,
    select, clearSelection, open,
    addNode, removeNode, setStart, rememberVideo, saveDraft,
  })
  provide(KEY, ctx)
  return ctx
}

export const useEditor = () => inject(KEY)
