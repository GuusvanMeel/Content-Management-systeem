<script setup>
// Video library of the own organisation (specs/002 contracts/ui.md). Replaces the browser-only
// prototype: videos come from the API, uploads go through the uploads store.
import { computed, onMounted, ref, watch } from 'vue'
import { deleteVideo, listVideos } from '../api/videos'
import { formatDate, formatDurationHms, formatGb, formatSize } from '../lib/format'
import { confirmDialog, toast } from '../lib/ui'
import { useUploads } from '../stores/uploads'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'

const uploads = useUploads()
const videos = ref([])
const loaded = ref(false)
const loadError = ref('')
const fileInput = ref(null)
const pending = ref(null) // { file, name } while the name dialog is open

const maxGb = computed(() => (uploads.settings ? formatGb(uploads.settings.maxFileSizeBytes) : '10'))

async function load() {
  try {
    videos.value = await listVideos()
    loadError.value = ''
  } catch (err) {
    if (err.status !== 401) loadError.value = "De video's konden niet worden geladen. Probeer het later opnieuw."
  } finally {
    loaded.value = true
  }
}

onMounted(() => {
  load()
  uploads.ensureSettings().catch(() => {})
})
// Reload once an upload has been added to the library; there is no polling.
watch(() => uploads.addedCount, load)

function chooseFiles() {
  fileInput.value.click()
}

function onFiles(event) {
  const files = [...event.target.files]
  event.target.value = ''
  if (files.length === 1) {
    pending.value = { file: files[0], name: files[0].name.replace(/\.mp4$/i, '') }
  } else if (files.length > 1) {
    uploads.addFiles(files)
  }
}

function startPending() {
  const { file, name } = pending.value
  pending.value = null
  uploads.addFiles([file], { name })
}

async function remove(video) {
  const ok = await confirmDialog({
    title: 'Video verwijderen?',
    body: `“${video.name}” verdwijnt uit de videobibliotheek.`,
    confirmLabel: 'Verwijderen',
    danger: true,
  })
  if (!ok) return
  try {
    await deleteVideo(video.id)
    toast('Video verwijderd')
  } catch (err) {
    if (err.status !== 404) {
      toast(err.message)
      return
    }
  }
  await load()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Video’s</h1>
      <button class="btn btn-primary" @click="chooseFiles"><Icon name="upload" :size="15" />Video toevoegen</button>
      <input ref="fileInput" type="file" accept=".mp4,video/mp4" multiple hidden data-test="file-input" @change="onFiles" />
    </div>

    <p v-if="loadError" class="error">{{ loadError }}</p>

    <ul v-if="videos.length" class="grid">
      <li v-for="video in videos" :key="video.id" class="card">
        <img class="th" :src="video.thumbnailUrl" :alt="video.name" loading="lazy" />
        <span class="name">{{ video.name }}</span>
        <span class="meta">{{ formatDurationHms(video.durationSeconds) }} · {{ formatSize(video.fileSizeBytes) }}</span>
        <span class="meta">Geüpload op {{ formatDate(video.uploadedAt) }}</span>
        <button class="btn btn-danger btn-sm delete" @click="remove(video)"><Icon name="trash" :size="14" />Verwijderen</button>
      </li>
    </ul>

    <div v-else-if="loaded && !loadError" class="empty">
      <p>Er staan nog geen video's in de bibliotheek. Voeg een 360°-video toe (MP4, H.264, maximaal {{ maxGb }} GB).</p>
      <button class="btn btn-primary" @click="chooseFiles"><Icon name="upload" :size="15" />Video toevoegen</button>
    </div>

    <Modal v-if="pending" title="Video toevoegen" @close="pending = null">
      <form id="video-name-form" class="field" @submit.prevent="startPending">
        <label for="video-name">Naam</label>
        <input id="video-name" v-model="pending.name" class="input" maxlength="255" />
        <span class="muted small">{{ pending.file.name }} · {{ formatSize(pending.file.size) }}</span>
      </form>
      <template #foot>
        <button class="btn btn-ghost" @click="pending = null">Annuleren</button>
        <button class="btn btn-primary" type="submit" form="video-name-form">Uploaden</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.error {
  padding: 8px 14px;
  border-radius: var(--r);
  background: var(--err-soft);
  color: var(--err);
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px 16px;
}
.card { display: grid; gap: 2px; align-content: start; }
.th {
  width: 100%;
  aspect-ratio: 2 / 1;
  object-fit: cover;
  border-radius: var(--r);
  border: 1px solid var(--line);
  background: var(--surface-2);
  margin-bottom: 6px;
}
.name { font-weight: 500; font-size: 0.9rem; line-height: 1.35; overflow-wrap: anywhere; }
.meta { font-size: 0.82rem; color: var(--muted); }
.delete { justify-self: start; margin-top: 4px; }
.empty { display: grid; justify-items: start; gap: 12px; color: var(--muted); }
</style>
