<script setup>
// A video step on the canvas. No connection handles: steps are not linked in this feature.
import { computed } from 'vue'
import { useEditor } from './context'
import { nodeLabel } from '../lib/course'
import { formatDuration } from '../lib/util'

const props = defineProps({ node: Object })
const ed = useEditor()
const video = computed(() => (props.node.videoId ? ed.stepVideos[props.node.videoId] : null))
const selected = computed(() => ed.selectedId === props.node.id)
const isStart = computed(() => ed.course.startId === props.node.id)
</script>

<template>
  <div class="vnode" :class="{ selected }">
    <div class="thumb" :style="video?.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : null">
      <span v-if="!video" class="novideo">Geen video</span>
    </div>
    <div class="body">
      <div v-if="isStart" class="tags"><span class="tag tag-start">Start</span></div>
      <strong class="t" :class="{ empty: !video }">{{ nodeLabel(node, ed.stepVideos) }}</strong>
      <span v-if="video?.durationSeconds" class="muted small">{{ formatDuration(video.durationSeconds) }}</span>
    </div>
  </div>
</template>

<style scoped>
.vnode {
  position: relative;
  width: 220px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  box-shadow: var(--shadow);
}
.vnode.selected { border-color: var(--brand); box-shadow: 0 0 0 2px var(--brand), var(--shadow); }
.thumb {
  aspect-ratio: 2 / 1;
  border-radius: 9px 9px 0 0;
  background: var(--surface-2) center / cover;
  display: grid;
  place-items: center;
}
.novideo { font-size: 0.8rem; color: var(--faint); }
.body { padding: 8px 12px 12px; display: grid; gap: 4px; }
.tags { display: flex; gap: 4px; }
.t { font-size: 0.9rem; font-weight: 500; line-height: 1.3; }
.t.empty { color: var(--faint); font-weight: 400; }

</style>
