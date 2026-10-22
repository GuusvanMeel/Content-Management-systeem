<script setup>
// Upload indicator (FR-006a, FR-006d, contracts/ui.md). A small round button with the upload
// icon and the overall progress as a ring: always on /videos, elsewhere only while uploads are
// listed. It stays collapsed when uploads start and progress. On /videos it opens by itself for
// events the teacher must notice (finished, error or rejection, lost connection) and collapses
// again after 4 seconds. A click opens the list, or the file picker when nothing is listed.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatSize } from '../lib/format'
import { TEXT, useUploads } from '../stores/uploads'
import Icon from './Icon.vue'

const AUTO_COLLAPSE_MS = 4000
// A little longer than the CSS animation, so it is removed even without an animationend event.
const DROP_MS = 900

const uploads = useUploads()
const route = useRoute()

const onVideosPage = computed(() => route?.path === '/videos')
const visible = computed(() => onVideosPage.value || uploads.items.length > 0)

const autoOpen = ref(false)
const pinnedOpen = ref(false)
const expanded = computed(() => uploads.items.length > 0 && (pinnedOpen.value || autoOpen.value))
let collapseTimer = null

watch(
  () => uploads.noticeCount,
  () => {
    if (!onVideosPage.value) return
    autoOpen.value = true
    clearTimeout(collapseTimer)
    collapseTimer = setTimeout(() => (autoOpen.value = false), AUTO_COLLAPSE_MS)
  },
)

// A file drops into the button when an upload starts; not with reduced motion (FR-006d).
const dropping = ref(false)
const dropKey = ref(0)
let dropTimer = null
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

watch(
  () => uploads.startedCount,
  () => {
    if (prefersReducedMotion()) return
    dropKey.value++
    dropping.value = true
    clearTimeout(dropTimer)
    dropTimer = setTimeout(() => (dropping.value = false), DROP_MS)
  },
)

onBeforeUnmount(() => {
  clearTimeout(collapseTimer)
  clearTimeout(dropTimer)
})

function onClick() {
  if (uploads.items.length === 0) {
    uploads.openFilePicker()
    return
  }
  if (expanded.value) {
    pinnedOpen.value = false
    autoOpen.value = false
    clearTimeout(collapseTimer)
  } else {
    pinnedOpen.value = true
  }
}

const label = computed(() => {
  if (uploads.items.length === 0) return 'Video toevoegen'
  return expanded.value ? 'Uploads verbergen' : `Uploads tonen (${summary.value})`
})
const summary = computed(() => `Uploaden: ${uploads.running.length} bezig, ${uploads.waiting.length} wachtend`)
const ringPercent = computed(() => Math.round(uploads.overallProgress * 100))
const hasProblem = computed(() => uploads.items.some((i) => ['rejected', 'expired'].includes(i.state)))

function percent(item) {
  return item.bytesTotal > 0 ? Math.floor((item.bytesUploaded / item.bytesTotal) * 100) : 0
}

function statusText(item) {
  switch (item.state) {
    case 'queued':
      return 'Wacht…'
    case 'uploading':
      return `${percent(item)}% (${formatSize(item.bytesUploaded)} van ${formatSize(item.bytesTotal)})`
    case 'retrying':
      return 'Verbinding verbroken, opnieuw proberen…'
    case 'verifying':
      return 'Video wordt gecontroleerd…'
    case 'done':
      return 'Toegevoegd aan de bibliotheek'
    case 'expired':
      return TEXT.expired
    default:
      return item.message
  }
}
</script>

<template>
  <section v-if="visible" class="uploads" aria-label="Uploads" aria-live="polite">
    <div v-if="expanded" class="panel" data-test="panel">
      <p class="summary">{{ summary }}</p>
      <ul class="list">
        <li v-for="item in uploads.items" :key="item.id" class="row" :class="item.state">
          <div class="line">
            <span class="name" :title="item.fileName">{{ item.name }}</span>
            <span v-if="item.resumed && ['uploading', 'retrying'].includes(item.state)" class="tag">Hervat</span>
          </div>
          <div v-if="['uploading', 'retrying'].includes(item.state)" class="bar" role="progressbar" :aria-valuenow="percent(item)" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: percent(item) + '%' }"></span>
          </div>
          <div class="line">
            <span class="status">{{ statusText(item) }}</span>
            <button v-if="item.state === 'queued'" class="link" @click="uploads.cancel(item.id)">Verwijderen uit wachtrij</button>
            <button v-else-if="['uploading', 'retrying'].includes(item.state)" class="link" @click="uploads.cancel(item.id)">Annuleren</button>
            <button v-else-if="item.state !== 'verifying'" class="link" @click="uploads.dismiss(item.id)">Sluiten</button>
          </div>
        </li>
      </ul>
    </div>
    <button
      class="circle"
      :class="{ problem: hasProblem }"
      :style="{ '--progress': ringPercent + '%' }"
      :aria-expanded="uploads.items.length > 0 ? expanded : undefined"
      :aria-label="label"
      :title="label"
      data-test="circle"
      @click="onClick"
    >
      <span class="inner"><Icon name="upload" :size="18" /></span>
      <span v-if="dropping" :key="dropKey" class="drop" aria-hidden="true" data-test="drop" @animationend="dropping = false">
        <Icon name="film" :size="16" />
      </span>
    </button>
  </section>
</template>

<style scoped>
.uploads {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 40;
  display: grid;
  justify-items: end;
  gap: 10px;
}
.circle {
  position: relative;
  width: 48px;
  height: 48px;
  padding: 3px;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  background: conic-gradient(var(--brand) var(--progress), var(--line) 0);
}
.circle.problem { background: conic-gradient(var(--err) 100%, var(--err) 0); }
.inner {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--surface);
  color: var(--brand-text);
}
.panel {
  width: min(380px, calc(100vw - 32px));
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.summary { margin: 0; padding: 10px 14px; background: var(--surface-2); font-weight: 500; }
.list { list-style: none; margin: 0; padding: 4px 0; max-height: 50vh; overflow-y: auto; }
.row { display: grid; gap: 4px; padding: 8px 14px; border-top: 1px solid var(--line); }
.row:first-child { border-top: 0; }
.line { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; min-width: 0; }
.name { font-weight: 500; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status { font-size: 0.82rem; color: var(--muted); }
.rejected .status, .expired .status { color: var(--err); }
.done .status { color: var(--ok); }
.tag { font-size: 0.75rem; padding: 1px 6px; border-radius: var(--r-sm); background: var(--brand-soft); color: var(--brand-text); }
.bar { height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--brand); transition: width 0.2s; }
.link { border: 0; background: none; padding: 0; color: var(--brand-text); font: inherit; font-size: 0.82rem; cursor: pointer; white-space: nowrap; }
.link:hover { text-decoration: underline; }
.drop {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin: -13px 0 0 -13px;
  border-radius: var(--r-sm);
  background: var(--brand);
  color: var(--brand-ink);
  box-shadow: var(--shadow);
  pointer-events: none;
  animation: drop-in 0.8s cubic-bezier(0.3, 0, 0.4, 1) forwards;
}
@keyframes drop-in {
  0% { transform: translateY(-90px) scale(1); opacity: 0; }
  20% { opacity: 1; }
  70% { transform: translateY(0) scale(0.9); opacity: 1; }
  100% { transform: translateY(0) scale(0.2); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .drop { display: none; }
}
</style>
