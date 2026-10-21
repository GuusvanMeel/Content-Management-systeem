<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { courseStatus } from '../lib/course'
import { timeAgo } from '../lib/util'
import { confirmDialog, toast } from '../lib/ui'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'

const app = useApp()
const router = useRouter()

const rows = computed(() =>
  [...app.orgCourses]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((c) => ({
      c,
      status: courseStatus(c),
      todo: app.validation(c).issues.length,
      videos: c.nodes.filter((n) => n.type === 'video').length,
      questions: c.nodes.filter((n) => n.type === 'question').length,
    })),
)

const showNew = ref(false)
const draft = ref({ name: '', description: '' })
const tried = ref(false)
const nameInput = ref(null)
function openNew() {
  draft.value = { name: '', description: '' }
  tried.value = false
  showNew.value = true
  nextTick(() => nameInput.value?.focus())
}
function create() {
  tried.value = true
  if (!draft.value.name.trim() || !draft.value.description.trim()) return
  const c = app.createCourse({ name: draft.value.name.trim(), description: draft.value.description.trim() })
  showNew.value = false
  router.push('/courses/' + c.id)
}
async function remove(c) {
  const ok = await confirmDialog({
    title: 'Cursus verwijderen?',
    body: `“${c.name}” wordt definitief verwijderd${c.published ? ', ook van de headsets' : ''}.`,
    confirmLabel: 'Verwijderen',
    danger: true,
  })
  if (ok) {
    app.deleteCourse(c.id)
    toast('Cursus verwijderd')
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Cursussen</h1>
      <button class="btn btn-primary" @click="openNew"><Icon name="plus" :size="15" />Nieuwe cursus</button>
    </div>

    <div v-if="!rows.length" class="empty">
      <p>Er zijn nog geen cursussen.</p>
      <button class="btn" @click="openNew">Maak de eerste cursus</button>
    </div>

    <ul v-else class="list">
      <li v-for="r in rows" :key="r.c.id" class="row">
        <RouterLink :to="'/courses/' + r.c.id" class="main">
          <span class="name">{{ r.c.name }}</span>
          <span class="meta">
            {{ r.videos }} {{ r.videos === 1 ? 'video' : 'video’s' }} · {{ r.questions }} {{ r.questions === 1 ? 'vraag' : 'vragen' }} · bewerkt {{ timeAgo(r.c.updatedAt) }}
            <span v-if="r.todo" class="todo"> · {{ r.todo }} te doen</span>
          </span>
        </RouterLink>
        <span class="status" :class="r.status.key">{{ r.status.label }}</span>
        <button class="icon-btn" title="Verwijderen" @click="remove(r.c)"><Icon name="trash" :size="16" /></button>
      </li>
    </ul>

    <Modal v-if="showNew" title="Nieuwe cursus" @close="showNew = false">
      <form id="new-course" class="form" @submit.prevent="create">
        <div class="field">
          <label for="nc-name">Naam</label>
          <input id="nc-name" ref="nameInput" v-model="draft.name" class="input" :class="{ invalid: tried && !draft.name.trim() }" />
        </div>
        <div class="field">
          <label for="nc-desc">Beschrijving</label>
          <textarea id="nc-desc" v-model="draft.description" class="textarea" rows="3" :class="{ invalid: tried && !draft.description.trim() }" />
        </div>
        <p v-if="tried && (!draft.name.trim() || !draft.description.trim())" class="hint err">Vul een naam en een beschrijving in.</p>
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
.todo { color: var(--err); }
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
