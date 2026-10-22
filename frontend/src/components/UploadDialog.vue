<script setup>
// Upload dialog (contracts/ui.md, FR-005, FR-013): every chosen file is checked in the browser
// before anything is sent. "Uploaden" stays off while a file is being checked or is invalid.
import { computed, onMounted, reactive } from 'vue'
import { formatSize } from '../lib/format'
import { checkVideo } from '../lib/videoCheck'
import { createPreview } from '../lib/videoPreview'
import Icon from './Icon.vue'
import Modal from './Modal.vue'

const props = defineProps({
  files: { type: Array, required: true },
  settings: { type: Object, required: true },
})
const emit = defineEmits(['close', 'submit'])

let nextKey = 1
const entries = reactive(
  props.files.map((file) => ({
    key: nextKey++,
    file,
    name: file.name.replace(/\.mp4$/i, '').slice(0, 255),
    check: { status: 'checking' },
    preview: null,
  })),
)

onMounted(() => {
  for (const entry of entries) {
    checkVideo(entry.file, props.settings)
      .then((result) => (entry.check = result))
      .catch(() => (entry.check = { status: 'unknown' }))
    if (/\.mp4$/i.test(entry.file.name)) {
      createPreview(entry.file).then((url) => (entry.preview = url)).catch(() => {})
    }
  }
})

const canUpload = computed(
  () => entries.length > 0 && entries.every((entry) => ['ok', 'unknown'].includes(entry.check.status)),
)

function removeEntry(key) {
  const index = entries.findIndex((entry) => entry.key === key)
  if (index >= 0) entries.splice(index, 1)
  if (entries.length === 0) emit('close')
}

function submit() {
  if (!canUpload.value) return
  emit('submit', entries.map((entry) => ({ file: entry.file, name: entry.name })))
}
</script>

<template>
  <Modal :title="entries.length > 1 ? `Video's toevoegen (${entries.length})` : 'Video toevoegen'" width="640px" @close="emit('close')">
    <form id="upload-dialog-form" class="list" @submit.prevent="submit">
      <div v-for="entry in entries" :key="entry.key" class="entry" :class="{ invalid: entry.check.status === 'invalid' }" data-test="entry">
        <div class="preview" :style="entry.preview ? { backgroundImage: `url(${entry.preview})` } : null" aria-hidden="true">
          <Icon v-if="!entry.preview" name="film" :size="20" />
        </div>
        <div class="details">
          <label class="label" :for="`video-name-${entry.key}`">Naam</label>
          <input :id="`video-name-${entry.key}`" v-model="entry.name" class="input" maxlength="255" />
          <span class="muted small">{{ entry.file.name }} · {{ formatSize(entry.file.size) }}</span>
          <span v-if="entry.check.status === 'checking'" class="muted small" data-test="checking">Bestand wordt gecontroleerd…</span>
          <p v-else-if="entry.check.status === 'invalid'" class="problem" role="alert" data-test="problem">{{ entry.check.message }}</p>
        </div>
        <button type="button" class="icon-btn remove" :aria-label="`${entry.file.name} uit de lijst halen`" title="Uit de lijst halen" @click="removeEntry(entry.key)">
          <Icon name="x" :size="16" />
        </button>
      </div>
    </form>
    <template #foot>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuleren</button>
      <button type="submit" form="upload-dialog-form" class="btn btn-primary" :disabled="!canUpload">Uploaden</button>
    </template>
  </Modal>
</template>

<style scoped>
.list { display: grid; gap: 14px; max-height: 60vh; overflow-y: auto; }
.entry {
  display: grid;
  grid-template-columns: 160px 1fr auto;
  gap: 14px;
  align-items: start;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--r);
}
.entry.invalid { border-color: var(--err); background: var(--err-soft); }
.preview {
  aspect-ratio: 2 / 1;
  border-radius: var(--r-sm);
  background: var(--surface-2) center / cover;
  display: grid;
  place-items: center;
  color: var(--faint);
}
.details { display: grid; gap: 4px; min-width: 0; }
.label { font-size: 0.85rem; font-weight: 500; }
.problem { margin: 4px 0 0; color: var(--err); font-weight: 500; font-size: 0.9rem; }
.remove { align-self: start; }
@media (max-width: 560px) {
  .entry { grid-template-columns: 1fr auto; }
  .preview { grid-column: 1 / -1; }
}
</style>
