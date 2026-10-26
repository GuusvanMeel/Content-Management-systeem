<script setup>
// The course editor on a local copy of the draft, with "Opslaan als concept", undo/redo and a
// question before leaving with unsaved changes (specs/004 FR-009, FR-009a, FR-020a, research R10).
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { saveCourse } from '../api/courses'
import { toEditor } from '../lib/courseMapping'
import { useCourseHistory } from '../lib/history'
import { confirmDialog } from '../lib/ui'
import { provideEditor } from './context'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import CanvasEditor from './CanvasEditor.vue'
import OverviewList from './OverviewList.vue'

const props = defineProps({ doc: Object })
const initial = toEditor(props.doc)
const course = ref(initial.course)
const history = useCourseHistory(() => course.value)
const ed = provideEditor({
  course,
  stepVideos: initial.stepVideos,
  doc: props.doc,
  history,
  save: (payload) => saveCourse(props.doc.id, payload),
})

const VARIANTS = [
  { key: 'popover', label: 'Canvas' },
  { key: 'inspector', label: 'Canvas + paneel' },
  { key: 'list', label: 'Lijst' },
]

function onKey(e) {
  if (!(e.ctrlKey || e.metaKey) || e.target.closest('input, textarea')) return
  const k = e.key.toLowerCase()
  if (k === 'z' && !e.shiftKey) history.undo()
  else if (k === 'y' || (k === 'z' && e.shiftKey)) history.redo()
  else return
  e.preventDefault()
}
// Closing or reloading the page: the browser asks its own question.
function onBeforeUnload(e) {
  if (!ed.dirty) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', onBeforeUnload)
  history.stop()
})

// Leaving inside the app. A lost session sends the user to a login page: never block that.
const LOGIN_PATHS = ['/login', '/admin/login']
onBeforeRouteLeave((to) => {
  if (!ed.dirty || LOGIN_PATHS.includes(to.path)) return true
  return confirmDialog({
    title: 'Wijzigingen niet opgeslagen',
    body: 'Je wijzigingen gaan verloren als je deze pagina verlaat.',
    confirmLabel: 'Verlaten',
    danger: true,
  })
})
</script>

<template>
  <div class="editor">
    <header class="bar">
      <RouterLink to="/courses" class="icon-btn" title="Terug naar cursussen"><Icon name="left" /></RouterLink>
      <span class="status draft">Concept</span>
      <button class="title" title="Naam en beschrijving" @click="ed.showSettings = true">
        <span class="name">{{ course.name || 'Naamloze cursus' }}</span>
        <Icon name="down" :size="14" />
      </button>

      <div class="seg" role="radiogroup" aria-label="Weergave">
        <button
          v-for="v in VARIANTS"
          :key="v.key"
          role="radio"
          :aria-checked="ed.variant === v.key"
          :class="{ on: ed.variant === v.key }"
          @click="ed.variant = v.key; ed.modalId = null"
        >{{ v.label }}</button>
      </div>

      <div class="right">
        <button class="icon-btn" :disabled="!history.canUndo.value" title="Ongedaan maken (Ctrl+Z)" @click="history.undo()"><Icon name="undo" /></button>
        <button class="icon-btn" :disabled="!history.canRedo.value" title="Opnieuw (Ctrl+Y)" @click="history.redo()"><Icon name="redo" /></button>
        <button class="btn btn-primary" data-test="save" :disabled="!ed.dirty || ed.saving" @click="ed.saveDraft()">
          {{ ed.saving ? 'Opslaan…' : ed.dirty ? 'Opslaan als concept' : 'Opgeslagen' }}
        </button>
      </div>
    </header>

    <div class="stage">
      <CanvasEditor v-if="ed.variant !== 'list'" :key="ed.variant" :mode="ed.variant" />
      <OverviewList v-else />
    </div>

    <Modal v-if="ed.showSettings" title="Cursus" @close="ed.showSettings = false">
      <div class="field">
        <label for="cs-name">Naam</label>
        <input id="cs-name" v-model="course.name" class="input" :class="{ invalid: !course.name.trim() || ed.fieldErrors.name }" />
      </div>
      <div class="field">
        <label for="cs-desc">Beschrijving</label>
        <textarea id="cs-desc" v-model="course.description" class="textarea" rows="4" :class="{ invalid: !course.description.trim() || ed.fieldErrors.description }" />
      </div>
      <template #foot><button class="btn btn-primary" @click="ed.showSettings = false">Klaar</button></template>
    </Modal>
  </div>
</template>

<style scoped>
.editor { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
  position: relative;
  z-index: 20;
}
.title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 4px 6px;
  border-radius: var(--r-sm);
  cursor: pointer;
  min-width: 0;
  color: var(--muted);
}
.title:hover { background: var(--surface-2); }
.name { font-size: 1.05rem; font-weight: 600; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 340px; }
.seg { margin-left: auto; }
.right { display: flex; align-items: center; gap: 6px; }
.stage { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.stage > :deep(*) { flex: 1; min-height: 0; }
@media (max-width: 900px) {
  .seg { margin-left: 0; order: 3; }
  .right { margin-left: auto; }
}
</style>
