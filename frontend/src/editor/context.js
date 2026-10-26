// Shared editor state for the three editor variants. The editor works on a local copy of the
// draft; nothing is stored until "Opslaan als concept" (specs/004 FR-009, research R10).
import { ref, computed, inject, provide, reactive, watch } from 'vue'
import * as C from '../lib/course'
import { checkCourse } from '../lib/completeness'
import { applyKeyChanges, keyChanges, savedKeys, savedVideos, toEditor, toPayload } from '../lib/courseMapping'
import { snapCourse } from '../lib/history'
import { getEditorVariant, setEditorVariant } from '../lib/editorPreference'
import { confirmDialog, toast } from '../lib/ui'

const KEY = Symbol('editor')

/**
 * `course` is a ref with the editor model, `stepVideos` a reactive map videoId → video details,
 * `doc` the draft document the course was loaded from, `save(payload)` stores a draft and returns
 * the saved document.
 */
export function provideEditor({ course, stepVideos: initialVideos, doc, history, save }) {
  const stepVideos = reactive(initialVideos)
  const selectedId = ref(null)
  const selectedEdge = ref(null) // '<sourceId>__<handle>' of a selected connection
  const hoverEdge = ref(null) // the connection under the pointer
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
  // The video of every saved video step, and the steps that came back through undo without the
  // video they had, because it can no longer be picked (FR-020d, research R5b).
  let savedVideoOf = savedVideos(doc)
  const lostVideoNotices = reactive(new Set())
  const dirty = computed(() => snapCourse(course.value) !== savedSnapshot.value)
  const saving = ref(false)
  const fieldErrors = ref({})

  const ordered = computed(() => C.orderedNodes(course.value))

  // The live completeness check (specs/005 FR-017). Issues present at the last click on
  // "Opslaan als concept" are red, newer ones orange (FR-022a, research R5).
  const issues = computed(() => checkCourse(course.value, stepVideos))
  const flaggedIssueIds = reactive(new Set())
  const isFlagged = (issue) => flaggedIssueIds.has(issue.id)

  // The connection in focus (hovered, else selected) and its two steps: they come to the front,
  // the rest dims, so crossing lines stay apart (verbeterronde 005, punt 4).
  const focusEdge = computed(() => hoverEdge.value ?? selectedEdge.value)
  const focusEnds = computed(() => {
    if (!focusEdge.value) return null
    const [source, handle] = focusEdge.value.split('__')
    return [source, C.targetOf(course.value, source, handle)]
  })

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
  // Connections (specs/005 FR-001 – FR-003, FR-020); all of them fall under undo.
  const connect = (source, handle, target) => C.connect(course.value, source, handle, target)
  const disconnect = (source, handle) => C.disconnect(course.value, source, handle)
  const addLinked = (sourceId, handle, type, pos) => C.addLinkedNode(course.value, sourceId, handle, type, pos)

  /** "Canvas ordenen" along the route, without a question; one undo puts it back (punt 7). */
  function tidyCanvas() {
    history.flush()
    C.autoLayout(course.value)
    focusRequest.value = { id: null, t: Date.now() }
    toast('Canvas geordend', { actionLabel: 'Ongedaan maken', action: () => history.undo() })
  }
  /** Marks a step as the only start step; `null` leaves the course without one (FR-018). */
  const setStart = (id) => (course.value.startId = id)

  const isLost = (videoId) => videoId != null && stepVideos[videoId]?.available === false

  /**
   * Before a step loses a video that the organisation can no longer pick: the warning of FR-020b.
   * Resolves true when the action may go ahead (always for available videos).
   */
  function confirmLosingVideo(node) {
    if (node?.type !== 'video' || !isLost(node.videoId)) return Promise.resolve(true)
    return confirmDialog({
      title: 'Video niet meer beschikbaar',
      body: 'Deze video is niet meer beschikbaar voor jouw organisatie (privé gemaakt of verwijderd). Haal je hem uit de cursus, dan kun je hem daarna niet opnieuw toevoegen.',
      confirmLabel: 'Doorgaan',
      danger: true,
    })
  }

  /** Removes a step, after the warning when needed. Resolves true when removed. */
  async function removeNode(id) {
    if (!(await confirmLosingVideo(C.findNode(course.value, id)))) return false
    C.deleteNode(course.value, id)
    if (selectedId.value === id) selectedId.value = null
    if (modalId.value === id) modalId.value = null
    toast('Onderdeel verwijderd', { actionLabel: 'Ongedaan maken', action: () => history.undo() })
    return true
  }

  /** "Video weghalen" (FR-020c): the step stays, without a video. */
  async function clearVideo(node) {
    if (!(await confirmLosingVideo(node))) return false
    node.videoId = null
    return true
  }

  /** Puts a video from the library in a step. Resolves true when chosen. */
  async function chooseVideo(node, video) {
    if (node.videoId !== video.id && !(await confirmLosingVideo(node))) return false
    rememberVideo(video)
    node.videoId = video.id
    lostVideoNotices.delete(node.id)
    return true
  }

  // Undo/redo must not bring back a video that can no longer be picked into a step that no longer
  // has it in the saved draft: the step comes back empty, with a notice (FR-020d).
  history.setTransform((snapshot) => {
    for (const n of snapshot.nodes) {
      if (n.type !== 'video' || !isLost(n.videoId) || savedVideoOf.get(n.id) === n.videoId) continue
      n.videoId = null
      lostVideoNotices.add(n.id)
    }
    return snapshot
  })

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
    fieldErrors.value = {}
    // FR-022a: what is still to do at this click turns red, whether or not the save succeeds.
    flaggedIssueIds.clear()
    for (const issue of issues.value.issues) flaggedIssueIds.add(issue.id)
    // A course needs a name and a description (FR-005): no request, the dialog opens instead.
    const missing = {}
    if (!course.value.name?.trim()) missing.name = 'Vul een naam en een beschrijving in.'
    if (!course.value.description?.trim()) missing.description = 'Vul een naam en een beschrijving in.'
    if (Object.keys(missing).length) {
      fieldErrors.value = missing
      showSettings.value = true
      return false
    }
    saving.value = true
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
      savedVideoOf = savedVideos(result)
      for (const key of [...lostVideoNotices]) {
        if (!changes[key]) continue
        lostVideoNotices.delete(key)
        lostVideoNotices.add(changes[key])
      }
      // Issue ids contain step and answer keys; keep flagged issues red under their new keys.
      for (const id of [...flaggedIssueIds]) {
        const renamed = id.split(':').map((part) => changes[part] ?? part).join(':')
        if (renamed === id) continue
        flaggedIssueIds.delete(id)
        flaggedIssueIds.add(renamed)
      }
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
    course, stepVideos, history, ordered, variant, issues,
    selectedId, selectedEdge, hoverEdge, focusEdge, focusEnds, modalId, focusRequest, showSettings,
    dirty, saving, fieldErrors, lostVideoNotices,
    select, selectEdge, clearSelection, open, isFlagged,
    addNode, addLinked, connect, disconnect, tidyCanvas, removeNode, setStart, clearVideo, chooseVideo, confirmLosingVideo, saveDraft,
  })
  provide(KEY, ctx)
  return ctx
}

export const useEditor = () => inject(KEY)
