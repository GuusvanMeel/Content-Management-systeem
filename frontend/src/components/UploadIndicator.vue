<script setup>
// Upload indicator on every CMS page (FR-006a, contracts/ui.md). Texts are customer-facing (Dutch).
import { computed, ref } from 'vue'
import { formatSize } from '../lib/format'
import { TEXT, useUploads } from '../stores/uploads'
import Icon from './Icon.vue'

const uploads = useUploads()
const collapsed = ref(false)

const summary = computed(() => {
  const busy = uploads.running.length
  const queued = uploads.waiting.length
  if (busy === 0 && queued === 0) return 'Uploads'
  return `Uploaden: ${busy} bezig, ${queued} wachtend`
})

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
  <section v-if="uploads.items.length" class="uploads" aria-label="Uploads" aria-live="polite">
    <button class="head" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <Icon name="upload" :size="15" />
      <span>{{ summary }}</span>
      <Icon name="down" :size="14" class="toggle" :class="{ open: !collapsed }" aria-hidden="true" />
    </button>
    <ul v-if="!collapsed" class="list">
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
          <button v-else-if="!['verifying'].includes(item.state)" class="link" @click="uploads.dismiss(item.id)">Sluiten</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.uploads {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 40;
  width: min(380px, calc(100vw - 32px));
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  background: var(--surface-2);
  font: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.head .toggle { margin-left: auto; color: var(--muted); transition: transform 0.15s; }
.head .toggle.open { transform: rotate(180deg); }
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
</style>
