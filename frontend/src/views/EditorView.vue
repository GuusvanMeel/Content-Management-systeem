<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useApp } from '../stores/app'
import { provideEditor } from '../editor/context'
import { useCourseHistory } from '../lib/history'
import { courseStatus } from '../lib/course'
import { usePublishing } from '../lib/publishing'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import CanvasEditor from '../editor/CanvasEditor.vue'
import OverviewList from '../editor/OverviewList.vue'

const props = defineProps({ id: String })
const app = useApp()
const course = computed(() => {
  const c = app.getCourse(props.id)
  return c && c.orgId === app.currentOrgId ? c : null
})
const history = course.value ? useCourseHistory(() => app.getCourse(props.id)) : null
const ed = course.value ? provideEditor({ app, course, history }) : null
const { publishCourse, unpublishCourse } = usePublishing()

const VARIANTS = [
  { key: 'popover', label: 'Canvas' },
  { key: 'inspector', label: 'Canvas + paneel' },
  { key: 'list', label: 'Lijst' },
]
const status = computed(() => courseStatus(course.value))
const todoOpen = ref(false)

function pick(issue) {
  todoOpen.value = false
  ed.focusIssue(issue)
}
function onKey(e) {
  if (!(e.ctrlKey || e.metaKey) || e.target.closest('input, textarea')) return
  const k = e.key.toLowerCase()
  if (k === 'z' && !e.shiftKey) history.undo()
  else if (k === 'y' || (k === 'z' && e.shiftKey)) history.redo()
  else return
  e.preventDefault()
}
const closePop = (e) => !e.target.closest('.todo-anchor') && (todoOpen.value = false)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('mousedown', closePop)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('mousedown', closePop)
})
</script>

<template>
  <div v-if="!course" class="page">
    <h1>Cursus niet gevonden</h1>
    <RouterLink to="/cursussen">Terug naar cursussen</RouterLink>
  </div>

  <div v-else class="editor">
    <header class="bar">
      <RouterLink to="/cursussen" class="icon-btn" title="Terug naar cursussen"><Icon name="left" /></RouterLink>
       <span class="status" :class="status.key">{{ status.label }}</span>
      <button class="title" title="Naam en beschrijving" @click="ed.showSettings = true">
        <span class="name">{{ course.name || 'Naamloze cursus' }}</span>
        <Icon name="down" :size="14" />
      </button>
     

      <div class="seg" role="radiogroup" aria-label="Weergave">
        <button
          v-for="v in VARIANTS"
          :key="v.key"
          role="radio"
          :aria-checked="app.editorVariant === v.key"
          :class="{ on: app.editorVariant === v.key }"
          @click="app.editorVariant = v.key; ed.modalId = null"
        >{{ v.label }}</button>
      </div>

      <div class="right">
        <button class="icon-btn" :disabled="!ed.history.canUndo" title="Ongedaan maken (Ctrl+Z)" @click="history.undo()"><Icon name="undo" /></button>
        <button class="icon-btn" :disabled="!ed.history.canRedo" title="Opnieuw (Ctrl+Y)" @click="history.redo()"><Icon name="redo" /></button>

        <div v-if="ed.validation.issues.length" class="todo-anchor">
          <button class="btn btn-ghost todo-btn" @click="todoOpen = !todoOpen">{{ ed.validation.issues.length }} te doen</button>
          <div v-if="todoOpen" class="pop">
            <p class="muted small">Los dit op om te kunnen publiceren.</p>
            <button v-for="(i, k) in ed.validation.issues" :key="k" class="pop-item" @click="pick(i)">{{ i.msg }}</button>
          </div>
        </div>

        <button v-if="status.key === 'live'" class="btn" @click="unpublishCourse(course)">Intrekken</button>
        <button v-else class="btn btn-primary" :disabled="!ed.validation.canPublish" @click="publishCourse(course)">
          {{ status.key === 'changed' ? 'Wijzigingen publiceren' : 'Publiceren' }}
        </button>
      </div>
    </header>

    <div class="stage">
      <CanvasEditor v-if="app.editorVariant !== 'list'" :key="app.editorVariant" :mode="app.editorVariant" />
      <OverviewList v-else />
    </div>

    <Modal v-if="ed.showSettings" title="Cursus" @close="ed.showSettings = false">
      <div class="field">
        <label for="cs-name">Naam</label>
        <input id="cs-name" v-model="course.name" class="input" :class="{ invalid: !course.name.trim() }" />
      </div>
      <div class="field">
        <label for="cs-desc">Beschrijving</label>
        <textarea id="cs-desc" v-model="course.description" class="textarea" rows="4" :class="{ invalid: !course.description.trim() }" />
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
.todo-anchor { position: relative; }
.todo-btn { color: var(--err); }
.pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 300px;
  max-height: 60vh;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow-lg);
  padding: 12px;
  display: grid;
  gap: 2px;
  z-index: 40;
}
.pop p { margin-bottom: 6px; }
.pop-item {
  text-align: left;
  border: 0;
  background: transparent;
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
  color: var(--err);
}
.pop-item:hover { background: var(--err-soft); }
.stage { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.stage > :deep(*) { flex: 1; min-height: 0; }
@media (max-width: 900px) {
  .seg { margin-left: 0; order: 3; }
  .right { margin-left: auto; }
}
</style>
