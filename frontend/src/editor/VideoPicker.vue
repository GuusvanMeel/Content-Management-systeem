<script setup>
import { ref, computed } from 'vue'
import { useApp } from '../stores/app'
import { videoThumb } from '../lib/panorama'
import { formatDuration } from '../lib/util'

const props = defineProps({ modelValue: String, invalid: Boolean, idBase: { type: String, default: 'vp' } })
const emit = defineEmits(['update:modelValue'])
const app = useApp()
const picking = ref(!props.modelValue)
const current = computed(() => app.videosById[props.modelValue])
function choose(v) {
  emit('update:modelValue', v.id)
  picking.value = false
}
</script>

<template>
  <div class="vp">
    <div v-if="current && !picking" class="current">
      <span class="th" :style="{ backgroundImage: `url(${videoThumb(current)})` }"></span>
      <div class="info">
        <span class="name">{{ current.name }}</span>
        <span class="muted small">{{ formatDuration(current.duration) }}</span>
      </div>
      <button class="btn btn-sm" @click="picking = true">Wijzig</button>
    </div>
    <ul v-else class="options" :class="{ invalid }">
      <li v-for="v in app.orgVideos" :key="v.id">
        <button class="opt" :class="{ on: v.id === modelValue }" @click="choose(v)">
          <span class="th" :style="{ backgroundImage: `url(${videoThumb(v)})` }"></span>
          <span class="name">{{ v.name }}</span>
        </button>
      </li>
      <li v-if="!app.orgVideos.length" class="muted small empty">Nog geen video’s. Upload ze bij Video’s.</li>
    </ul>
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
</style>
