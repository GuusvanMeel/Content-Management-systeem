<script setup>
import { ref, computed } from 'vue'
import { useApp } from '../stores/app'
import { videoThumb } from '../lib/panorama'
import { formatDuration, uid } from '../lib/util'
import { confirmDialog, toast } from '../lib/ui'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'

const app = useApp()
const fileInput = ref(null)
const uploads = ref([])
const error = ref('')
const openId = ref(null)
const open = computed(() => (openId.value ? app.videosById[openId.value] : null))
const usage = computed(() => (open.value ? app.videoUsage(open.value.id) : []))

const SUPPORTED = ['mp4', 'webm']

// Reads size, duration and a thumbnail frame. Nothing is played.
function readMeta(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('video')
    let done = false
    const finish = (meta) => {
      if (done) return
      done = true
      URL.revokeObjectURL(url)
      resolve(meta)
    }
    el.preload = 'metadata'
    el.muted = true
    el.src = url
    el.onloadedmetadata = () => {
      const meta = { width: el.videoWidth, height: el.videoHeight, duration: el.duration }
      el.currentTime = Math.min(1, el.duration / 2)
      el.onseeked = () => {
        let thumb = null
        try {
          const c = document.createElement('canvas')
          c.width = 512
          c.height = 256
          c.getContext('2d').drawImage(el, 0, 0, 512, 256)
          thumb = c.toDataURL('image/jpeg', 0.75)
        } catch {}
        finish({ ...meta, thumb })
      }
    }
    el.onerror = () => finish({ unreadable: true })
    setTimeout(() => finish({ unreadable: true }), 6000)
  })
}

async function onFiles(files) {
  error.value = ''
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!SUPPORTED.includes(ext)) {
      error.value = `${file.name}: dit formaat wordt niet ondersteund. Gebruik MP4 of WebM.`
      continue
    }
    const item = { id: uid('up'), name: file.name.replace(/\.[^.]+$/, ''), progress: 0 }
    uploads.value.push(item)
    const meta = await readMeta(file)
    if (!meta.unreadable && Math.abs(meta.width / meta.height - 2) > 0.05 && Math.abs(meta.width / meta.height - 1) > 0.05) {
      uploads.value = uploads.value.filter((u) => u.id !== item.id)
      error.value = `${file.name}: dit is geen 360°-video (${meta.width} × ${meta.height}). Een 360°-video is twee keer zo breed als hoog.`
      continue
    }
    await fakeUpload(item.id)
    uploads.value = uploads.value.filter((u) => u.id !== item.id)
    app.addVideo({
      name: item.name,
      duration: meta.unreadable ? 0 : Math.round(meta.duration),
      resolution: meta.unreadable ? 'onbekend' : `${meta.width} × ${meta.height}`,
      format: ext.toUpperCase(),
      sizeMB: Math.max(1, Math.round(file.size / 1e6)),
      thumb: meta.thumb ?? null,
      scene: { kind: 'hall', seed: Math.floor(Math.random() * 999) },
    })
  }
}
function fakeUpload(id) {
  const t0 = performance.now()
  return new Promise((resolve) => {
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / 1500)
      const u = uploads.value.find((x) => x.id === id)
      if (u) u.progress = p
      p < 1 ? requestAnimationFrame(step) : resolve()
    }
    step()
  })
}

async function remove() {
  const v = open.value
  const ok = await confirmDialog({ title: 'Video verwijderen?', body: `“${v.name}” wordt uit de bibliotheek verwijderd.`, confirmLabel: 'Verwijderen', danger: true })
  if (ok && app.deleteVideo(v.id)) {
    openId.value = null
    toast('Video verwijderd')
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Video’s</h1>
      <button class="btn btn-primary" @click="fileInput.click()"><Icon name="upload" :size="15" />Video uploaden</button>
      <input id="video-file" ref="fileInput" type="file" accept=".mp4,.webm,video/mp4,video/webm" multiple hidden @change="onFiles([...$event.target.files]); $event.target.value = ''" />
    </div>

    <p v-if="error" class="error">
      <span>{{ error }}</span>
      <button class="icon-btn" aria-label="Melding sluiten" @click="error = ''"><Icon name="x" :size="15" /></button>
    </p>

    <ul class="grid">
      <li v-for="u in uploads" :key="u.id" class="card uploading">
        <span class="th"><span class="bar"><span :style="{ width: u.progress * 100 + '%' }"></span></span></span>
        <span class="name">{{ u.name }}</span>
        <span class="meta">Uploaden…</span>
      </li>
      <li v-for="v in app.orgVideos" :key="v.id">
        <button class="card" @click="openId = v.id">
          <span class="th" :style="{ backgroundImage: `url(${videoThumb(v)})` }"></span>
          <span class="name">{{ v.name }}</span>
          <span class="meta">{{ formatDuration(v.duration) }}<template v-if="!app.videoUsage(v.id).length"> · niet in gebruik</template></span>
        </button>
      </li>
    </ul>
    <p v-if="!app.orgVideos.length && !uploads.length" class="muted">Nog geen video’s. Upload een 360°-video in MP4 of WebM.</p>

    <Modal v-if="open" title="Video" width="560px" @close="openId = null">
      <span class="big-th" :style="{ backgroundImage: `url(${videoThumb(open)})` }"></span>
      <div class="field">
        <label for="video-name">Naam</label>
        <input id="video-name" v-model="open.name" class="input" />
      </div>
      <dl class="facts">
        <div><dt>Duur</dt><dd>{{ formatDuration(open.duration) }}</dd></div>
        <div><dt>Resolutie</dt><dd>{{ open.resolution }}</dd></div>
        <div><dt>Formaat</dt><dd>{{ open.format }}</dd></div>
      </dl>
      <div class="field">
        <span class="label">Gebruikt in</span>
        <ul v-if="usage.length" class="usage">
          <li v-for="c in usage" :key="c.id"><RouterLink :to="'/cursussen/' + c.id" @click="openId = null">{{ c.name }}</RouterLink></li>
        </ul>
        <span v-else class="muted">Geen cursussen</span>
      </div>
      <template #foot>
        <span v-if="usage.length" class="muted small foot-note">Kan niet verwijderd worden zolang een cursus deze video gebruikt.</span>
        <button class="btn btn-danger" :disabled="!!usage.length" @click="remove">Verwijderen</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 6px 6px 14px;
  border-radius: var(--r);
  background: var(--err-soft);
  color: var(--err);
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px 16px;
}
.card {
  width: 100%;
  display: grid;
  gap: 2px;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.th {
  aspect-ratio: 2 / 1;
  border-radius: var(--r);
  background: var(--surface-2) center / cover;
  margin-bottom: 6px;
  border: 1px solid var(--line);
  display: grid;
  align-items: end;
  padding: 10px;
}
.card:hover .th { border-color: var(--brand); box-shadow: 0 0 0 1px var(--brand); }
.name { font-weight: 500; font-size: 0.9rem; line-height: 1.35; }
.meta { font-size: 0.82rem; color: var(--muted); }
.bar { height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--brand-2); }
.uploading { cursor: default; }
.big-th { display: block; aspect-ratio: 2 / 1; max-width: 100%; border-radius: var(--r); background: var(--surface-2) center / cover; }
.facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
.facts dt { font-size: 0.82rem; color: var(--muted); }
.facts dd { margin: 0; }
.usage { margin: 0; padding-left: 18px; }
.foot-note { margin-right: auto; align-self: center; }
</style>
