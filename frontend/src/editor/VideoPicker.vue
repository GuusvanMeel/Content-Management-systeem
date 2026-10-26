<script setup>
// Picks a video from the library: the organisation's own videos and the videos available to it,
// exactly as in the video library (specs/004 FR-014). The chosen video's details come from the
// editor's stepVideos map, so a video that is no longer available still shows (FR-016).
import { ref, computed, onMounted } from 'vue'
import { listVideos } from '../api/videos'
import { formatDuration } from '../lib/util'
import { useEditor } from './context'

const props = defineProps({ modelValue: Number, idBase: { type: String, default: 'vp' } })
const emit = defineEmits(['update:modelValue'])
const ed = useEditor()
const picking = ref(!props.modelValue)
const videos = ref([])
const loadState = ref('loading') // loading | ready | error
const current = computed(() => (props.modelValue ? ed.stepVideos[props.modelValue] : null))

async function load() {
  loadState.value = 'loading'
  try {
    videos.value = await listVideos()
    loadState.value = 'ready'
  } catch {
    loadState.value = 'error'
  }
}
onMounted(load)

function choose(video) {
  ed.rememberVideo(video)
  emit('update:modelValue', video.id)
  picking.value = false
}
</script>

<template>
  <div class="vp">
    <div v-if="current && !picking" class="current">
      <span class="th" :style="current.thumbnailUrl ? { backgroundImage: `url(${current.thumbnailUrl})` } : null"></span>
      <div class="info">
        <span class="name">{{ current.name }}</span>
        <span class="muted small">{{ formatDuration(current.durationSeconds ?? 0) }}</span>
      </div>
      <button class="btn btn-sm" @click="picking = true">Wijzig</button>
    </div>
    <ul v-else class="options">
      <li v-if="loadState === 'loading'" class="muted small empty">Video's laden…</li>
      <li v-else-if="loadState === 'error'" class="muted small empty">
        De video's konden niet worden geladen. <button class="btn btn-sm btn-ghost" @click="load">Opnieuw</button>
      </li>
      <template v-else>
        <li v-for="v in videos" :key="v.id">
          <button class="opt" :class="{ on: v.id === modelValue }" data-test="video-option" @click="choose(v)">
            <span class="th" :style="{ backgroundImage: `url(${v.thumbnailUrl})` }"></span>
            <span class="info">
              <span class="name">{{ v.name }}</span>
              <span class="muted small">{{ formatDuration(v.durationSeconds ?? 0) }}</span>
            </span>
            <!-- Same owner label as the library (OwnerPill), as text: a button cannot sit inside this button. -->
            <span class="owner" :class="{ own: v.owner.isOwn }">{{ v.owner.isOwn ? 'Eigen' : v.owner.name }}</span>
          </button>
        </li>
        <li v-if="!videos.length" class="muted small empty">Nog geen video’s. Upload ze bij Video’s.</li>
      </template>
    </ul>
    <div v-if="picking && current" class="cancel">
      <button class="btn btn-sm btn-ghost" @click="picking = false">Annuleren</button>
    </div>
  </div>
</template>

<style scoped>
.current { display: flex; gap: 12px; align-items: center; }
.th { width: 88px; aspect-ratio: 2 / 1; border-radius: 4px; background: var(--surface-2) center / cover; flex-shrink: 0; }
.info { display: grid; flex: 1; min-width: 0; }
.name { font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.options {
  list-style: none;
  margin: 0;
  padding: 4px;
  max-height: 240px;
  overflow: auto;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-sm);
  display: grid;
  gap: 2px;
}
.opt {
  width: 100%;
  display: flex;
  gap: 10px;
  align-items: center;
  border: 0;
  background: transparent;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  text-align: left;
}
.opt .th { width: 64px; }
.opt:hover { background: var(--surface-2); }
.opt.on { background: var(--brand-soft); }
.empty { padding: 8px; }
.owner {
  flex-shrink: 0;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--brand-2-soft);
  color: var(--fg);
}
.owner.own { background: var(--surface-2); color: var(--muted); font-weight: 500; }
.cancel { margin-top: 6px; }
</style>
