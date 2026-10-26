<script setup>
// The organisation's courses, all drafts (specs/004 contracts/ui.md § Cursussen).
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listCourses, createCourse, deleteCourse } from '../api/courses'
import { timeAgo } from '../lib/util'
import { confirmDialog, toast } from '../lib/ui'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import DescriptionField from '../components/DescriptionField.vue'

const router = useRouter()
const courses = ref([])
const loadState = ref('loading') // loading | ready | error

async function load() {
  loadState.value = 'loading'
  try {
    courses.value = await listCourses()
    loadState.value = 'ready'
  } catch {
    loadState.value = 'error'
  }
}
onMounted(load)

const rows = computed(() =>
  courses.value.map((c) => ({ c, updatedAt: new Date(c.updatedAt).getTime(), videos: c.videoStepCount, questions: c.questionStepCount })),
)

// Limits of FR-026, counted like the server (code points).
const NAME_MAX = 255
const DESCRIPTION_MAX = 1000
const showNew = ref(false)
const draft = ref({ name: '', description: '' })
const tried = ref(false)
const serverErrors = ref({})
const nameField = ref(null)
const message = computed(() => {
  if (!tried.value) return ''
  if (!draft.value.name.trim() || !draft.value.description.trim()) return 'Vul een naam en een beschrijving in.'
  return serverErrors.value.name ?? serverErrors.value.description ?? serverErrors.value.general ?? ''
})
function openNew() {
  draft.value = { name: '', description: '' }
  tried.value = false
  serverErrors.value = {}
  showNew.value = true
  nextTick(() => nameField.value?.$el.querySelector('input')?.focus())
}
async function create() {
  tried.value = true
  serverErrors.value = {}
  if (!draft.value.name.trim() || !draft.value.description.trim()) return
  try {
    const c = await createCourse({ name: draft.value.name.trim(), description: draft.value.description.trim() })
    showNew.value = false
    router.push('/courses/' + c.id)
  } catch (error) {
    serverErrors.value = error.fields && Object.keys(error.fields).length ? error.fields : { general: error.message }
  }
}
async function remove(c) {
  const ok = await confirmDialog({
    title: 'Cursus verwijderen?',
    body: `“${c.name}” wordt verwijderd.`,
    confirmLabel: 'Verwijderen',
    danger: true,
  })
  if (!ok) return
  try {
    await deleteCourse(c.id)
    courses.value = courses.value.filter((x) => x.id !== c.id)
    toast('Cursus verwijderd')
  } catch (error) {
    toast(error.message)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Cursussen</h1>
      <button class="btn btn-primary" @click="openNew"><Icon name="plus" :size="15" />Nieuwe cursus</button>
    </div>

    <p v-if="loadState === 'loading'" class="muted">Cursussen laden…</p>
    <div v-else-if="loadState === 'error'" class="empty">
      <p>De cursussen konden niet worden geladen.</p>
      <button class="btn" @click="load">Opnieuw</button>
    </div>
    <div v-else-if="!rows.length" class="empty">
      <p>Er zijn nog geen cursussen.</p>
      <button class="btn" @click="openNew">Maak de eerste cursus</button>
    </div>

    <ul v-else class="list">
      <li v-for="r in rows" :key="r.c.id" class="row">
        <RouterLink :to="'/courses/' + r.c.id" class="main">
          <span class="name">{{ r.c.name }}</span>
          <span class="meta">
            {{ r.videos }} {{ r.videos === 1 ? 'video' : 'video’s' }} · {{ r.questions }} {{ r.questions === 1 ? 'vraag' : 'vragen' }} · bewerkt {{ timeAgo(r.updatedAt) }}
          </span>
        </RouterLink>
        <span class="status draft">Concept</span>
        <button class="icon-btn" title="Verwijderen" @click="remove(r.c)"><Icon name="trash" :size="16" /></button>
      </li>
    </ul>

    <Modal v-if="showNew" title="Nieuwe cursus" @close="showNew = false">
      <form id="new-course" class="form" @submit.prevent="create">
        <DescriptionField
          id="nc-name"
          ref="nameField"
          v-model="draft.name"
          label="Naam"
          subject="De naam"
          test-id="course-name"
          :max="NAME_MAX"
          :optional="false"
          :multiline="false"
          :invalid="tried && (!draft.name.trim() || !!serverErrors.name)"
        />
        <DescriptionField
          id="nc-desc"
          v-model="draft.description"
          test-id="course-description"
          :max="DESCRIPTION_MAX"
          :optional="false"
          :invalid="tried && (!draft.description.trim() || !!serverErrors.description)"
        />
        <p v-if="message" class="hint err" data-test="create-error">{{ message }}</p>
      </form>
      <template #foot>
        <button class="btn btn-ghost" @click="showNew = false">Annuleren</button>
        <button class="btn btn-primary" type="submit" form="new-course">Aanmaken</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.row { display: flex; align-items: center; gap: 16px; padding: 0 12px 0 0; }
.row + .row { border-top: 1px solid var(--line); }
.row:hover { background: var(--brand-soft); }
.row:hover .name { color: var(--brand-text); }
.main { flex: 1; min-width: 0; display: grid; gap: 2px; padding: 14px 20px; text-decoration: none; color: inherit; }
.name { font-weight: 600; }
.meta { font-size: 0.85rem; color: var(--muted); }
.row .icon-btn { opacity: 0; }
.row:hover .icon-btn,
.row .icon-btn:focus-visible { opacity: 1; }
.empty {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 48px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  color: var(--muted);
}
.form { display: grid; gap: 16px; }
@media (max-width: 600px) {
  .row { flex-wrap: wrap; gap: 0 12px; padding-bottom: 12px; }
  .row .status { padding-left: 20px; }
  .row .icon-btn { opacity: 1; margin-left: auto; }
}
</style>
