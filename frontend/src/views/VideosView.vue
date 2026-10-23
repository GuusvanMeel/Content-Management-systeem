<script setup>
// Central video library (specs/002 and specs/003 contracts/ui.md): own videos and videos of other
// organisations that are available to this one, in one list. Search, filter and sort work on that
// list in the browser (FR-025a); the video window opens on top, so the list keeps its state.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { deleteVideo, listVideos } from '../api/videos'
import { formatDate, formatDurationHms, formatGb, formatSize } from '../lib/format'
import { confirmDialog, toast } from '../lib/ui'
import { DEFAULT_SORT, libraryView, OWNERSHIP_OPTIONS, SORT_OPTIONS } from '../lib/videoLibrary'
import { useUploads } from '../stores/uploads'
import Icon from '../components/Icon.vue'
import OwnerPill from '../components/OwnerPill.vue'
import ResumeNotice from '../components/ResumeNotice.vue'
import UploadDialog from '../components/UploadDialog.vue'
import VideoDetailsDialog from '../components/VideoDetailsDialog.vue'

const VISIBILITY_LABEL = { public: 'Algemeen', selective: 'Selectief', private: 'Alleen eigen organisatie' }

const uploads = useUploads()
const videos = ref([])
const loaded = ref(false)
const loadError = ref('')
const fileInput = ref(null)
const chosenFiles = ref(null) // files in the upload dialog, or null when it is closed
const openVideoId = ref(null) // video in the video window, or null when it is closed

const query = ref('')
const ownership = ref('all')
const sort = ref(DEFAULT_SORT)
// Organisation chosen by clicking its pill: { id, name }, or null (FR-025b).
const ownerFilter = ref(null)
const shown = computed(() =>
  libraryView(videos.value, {
    query: query.value,
    ownership: ownership.value,
    ownerId: ownerFilter.value?.id ?? null,
    sort: sort.value,
  }),
)
const filtering = computed(() => query.value.trim() !== '' || ownership.value !== 'all' || ownerFilter.value !== null)

function filterOnOwner(owner) {
  ownerFilter.value = { id: owner.id, name: owner.name }
}

// From the video window: the window closes and the library shows that organisation.
function filterOnOwnerFromWindow(owner) {
  openVideoId.value = null
  filterOnOwner(owner)
}

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

// The round upload button opens this page's file picker when no uploads are listed (FR-006a).
let unregisterFilePicker = () => {}
onBeforeUnmount(() => unregisterFilePicker())

onMounted(() => {
  unregisterFilePicker = uploads.registerFilePicker(chooseFiles)
  load()
  uploads
    .ensureSettings()
    .then(() => uploads.loadInterrupted())
    .catch(() => {})
})
// Reload once an upload has been added to the library; there is no polling.
watch(() => uploads.addedCount, load)

function chooseFiles() {
  fileInput.value.click()
}

async function onFiles(event) {
  const files = [...event.target.files]
  event.target.value = ''
  if (files.length === 0) return
  try {
    await uploads.ensureSettings()
  } catch {
    return
  }
  chosenFiles.value = files
}

// The dialog has checked every file before anything is sent (FR-013).
function startUploads(entries) {
  chosenFiles.value = null
  uploads.addFiles(entries)
}

function clearFilters() {
  query.value = ''
  ownership.value = 'all'
  ownerFilter.value = null
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

    <ResumeNotice />

    <p v-if="loadError" class="error">{{ loadError }}</p>

    <div v-if="videos.length" class="toolbar" data-test="toolbar">
      <input
        v-model="query"
        class="input search"
        type="search"
        placeholder="Zoeken op naam, beschrijving of organisatie"
        aria-label="Zoeken op naam, beschrijving of organisatie"
        data-test="search"
      />
      <button
        v-if="ownerFilter"
        type="button"
        class="chip"
        :aria-label="`Filter op ${ownerFilter.name} wissen`"
        data-test="owner-filter"
        @click="ownerFilter = null"
      >
        Organisatie: {{ ownerFilter.name }} <span class="chip-x" aria-hidden="true">✕</span>
      </button>
      <div class="seg" role="group" aria-label="Welke video's">
        <button
          v-for="option in OWNERSHIP_OPTIONS"
          :key="option.key"
          type="button"
          :class="{ on: ownership === option.key }"
          :aria-pressed="ownership === option.key"
          :data-test="`ownership-${option.key}`"
          @click="ownership = option.key"
        >
          {{ option.label }}
        </button>
      </div>
      <select v-model="sort" class="select sort" aria-label="Sorteren" data-test="sort">
        <option v-for="option in SORT_OPTIONS" :key="option.key" :value="option.key">{{ option.label }}</option>
      </select>
    </div>

    <ul v-if="shown.length" class="grid">
      <li v-for="video in shown" :key="video.id" class="card" data-test="video">
        <button type="button" class="open" :aria-label="`${video.name} openen`" @click="openVideoId = video.id">
          <img class="th" :src="video.thumbnailUrl" :alt="video.name" loading="lazy" />
          <span class="name">{{ video.name }}</span>
        </button>
        <span class="labels">
          <OwnerPill :owner="video.owner" @filter="filterOnOwner" />
          <span v-if="video.owner.isOwn" class="tag" data-test="visibility">{{ VISIBILITY_LABEL[video.visibility] }}</span>
        </span>
        <span v-if="video.description" class="description" data-test="description">{{ video.description }}</span>
        <span class="meta">{{ formatDurationHms(video.durationSeconds) }} · {{ formatSize(video.fileSizeBytes) }}</span>
        <span class="meta">Geüpload op {{ formatDate(video.uploadedAt) }}</span>
        <button v-if="video.owner.isOwn" class="btn btn-danger btn-sm delete" data-test="delete" @click="remove(video)">
          <Icon name="trash" :size="14" />Verwijderen
        </button>
      </li>
    </ul>

    <div v-else-if="videos.length && filtering" class="empty" data-test="no-results">
      <p>Geen video's gevonden</p>
      <button class="btn" @click="clearFilters">Zoekterm en filter wissen</button>
    </div>

    <div v-else-if="loaded && !loadError && !videos.length" class="empty">
      <p>Er staan nog geen video's in de bibliotheek. Voeg een 360°-video toe (MP4, H.264, maximaal {{ maxGb }} GB).</p>
      <button class="btn btn-primary" @click="chooseFiles"><Icon name="upload" :size="15" />Video toevoegen</button>
    </div>

    <UploadDialog v-if="chosenFiles" :files="chosenFiles" :settings="uploads.settings" @close="chosenFiles = null" @submit="startUploads" />
    <VideoDetailsDialog
      v-if="openVideoId !== null"
      :video-id="openVideoId"
      :description-max-length="uploads.settings?.descriptionMaxLength ?? 1000"
      @close="openVideoId = null"
      @changed="load"
      @filter-owner="filterOnOwnerFromWindow"
    />
  </div>
</template>

<style scoped>
.error {
  padding: 8px 14px;
  border-radius: var(--r);
  background: var(--err-soft);
  color: var(--err);
}
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search { flex: 1 1 260px; }
.sort { width: auto; }
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px 16px;
}
.card { display: grid; gap: 2px; align-content: start; }
.open { display: grid; gap: 2px; padding: 0; border: 0; background: none; text-align: left; cursor: pointer; color: inherit; font: inherit; }
.open:hover .name { text-decoration: underline; }
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
.labels { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; margin: 2px 0; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--pill-other-border);
  border-radius: 999px;
  background: var(--pill-other-bg);
  color: var(--pill-other-fg);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.chip:hover { background: var(--pill-other-bg-hover); }
.chip-x { font-size: 0.8rem; }
/* At most two lines in the list; the full description is in the video window (FR-022). */
.description {
  font-size: 0.82rem;
  color: var(--fg);
  white-space: pre-line;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}
.meta { font-size: 0.82rem; color: var(--muted); }
.delete { justify-self: start; margin-top: 4px; }
.empty { display: grid; justify-items: start; gap: 12px; color: var(--muted); }
</style>
