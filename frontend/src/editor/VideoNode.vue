<script setup>
// A video step on the canvas, with its connection points (specs/005 FR-019) and status (FR-022).
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useEditor } from './context'
import { incoming, nodeLabel } from '../lib/course'
import { formatDuration } from '../lib/util'
import Icon from '../components/Icon.vue'
import StepBadges from './StepBadges.vue'

const props = defineProps({ node: Object })
const ed = useEditor()
const video = computed(() => (props.node.videoId ? ed.stepVideos[props.node.videoId] : null))
const selected = computed(() => ed.selectedId === props.node.id)
const lostNotice = computed(() => !props.node.videoId && ed.lostVideoNotices.has(props.node.id))
const issue = computed(() => ed.issues.byNode[props.node.id]?.[0] ?? null)
// Punt 4: with a connection in focus, its two steps stand out and the others dim.
const focusEnd = computed(() => !!ed.focusEnds?.includes(props.node.id))
const dimmed = computed(() => !!ed.focusEnds && !focusEnd.value)
// Punt 5: how many connections arrive here, only as a tooltip.
const incomingCount = computed(() => incoming(ed.course, props.node.id).length)
const tooltip = computed(() =>
  incomingCount.value ? `Wordt bereikt vanuit ${incomingCount.value} ${incomingCount.value === 1 ? 'verbinding' : 'verbindingen'}` : null,
)
</script>

<template>
  <div class="vnode" :class="{ selected, todo: issue, flagged: issue && ed.isFlagged(issue), 'focus-end': focusEnd, dimmed }" :title="tooltip" data-test="block">
    <Handle id="in" type="target" :position="Position.Top" :connectable-start="false" class="h-in" />
    <div class="thumb" :style="video?.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : null">
      <span v-if="!video" class="novideo">Geen video</span>
    </div>
    <div class="body">
      <StepBadges :node="node" />
      <strong class="t" :class="{ empty: !video }">{{ nodeLabel(node, ed.stepVideos) }}</strong>
      <span v-if="video?.durationSeconds" class="muted small">{{ formatDuration(video.durationSeconds) }}</span>
      <span v-if="lostNotice" class="lost">Deze video is niet meer beschikbaar en kan niet worden teruggezet.</span>
    </div>
    <Handle id="next" type="source" :position="Position.Bottom" class="h-out" title="Klik of sleep om te verbinden">
      <span class="plus"><Icon name="plus" :size="14" /></span>
    </Handle>
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
.vnode.todo:not(.selected) { border-color: color-mix(in srgb, var(--todo) 55%, var(--line-strong)); }
.vnode.flagged:not(.selected) { border-color: var(--err); }
.vnode.focus-end { box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 35%, transparent), var(--shadow); }
.vnode.dimmed { opacity: 0.45; }
.thumb {
  aspect-ratio: 2 / 1;
  border-radius: 9px 9px 0 0;
  background: var(--surface-2) center / cover;
  display: grid;
  place-items: center;
}
.novideo { font-size: 0.8rem; color: var(--faint); }
.body { padding: 8px 12px 26px; display: grid; gap: 4px; }
.t { font-size: 0.9rem; font-weight: 500; line-height: 1.3; }
.t.empty { color: var(--faint); font-weight: 400; }
.lost { font-size: 0.8rem; color: var(--err); line-height: 1.3; }

/* Connection handles.
   Incoming: a thin strip along the top edge. While a connection is being dragged it covers the whole
   block, and the top edge lights up when the block is under the pointer.
   Outgoing: the whole bottom edge; it lights up on hover. */
.h-in.vue-flow__handle {
  top: 0;
  left: 0;
  right: 0;
  width: auto;
  height: 10px;
  min-height: 0;
  transform: none;
  border: 0;
  border-radius: 10px 10px 0 0;
  background: transparent;
}
:global(.canvas.is-connecting .vue-flow__handle.h-in) { height: 100%; border-radius: 10px; z-index: 2; }
.h-in.vue-flow__handle.valid {
  background: color-mix(in srgb, var(--brand) 10%, transparent);
  box-shadow: inset 0 4px 0 var(--brand);
}
/* The handle covers the bottom strip of the block plus the + that sticks out below it,
   so the whole area reacts the same way (same cursor, same highlight). */
.h-out.vue-flow__handle {
  top: auto;
  bottom: -14px;
  left: 0;
  right: 0;
  width: auto;
  height: 36px;
  min-height: 0;
  transform: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: crosshair;
}
.h-out.vue-flow__handle::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 22px;
  border-radius: 0 0 10px 10px;
  transition: background 0.12s, box-shadow 0.12s;
}
.h-out.vue-flow__handle:hover::before {
  background: color-mix(in srgb, var(--brand) 14%, transparent);
  box-shadow: inset 0 -4px 0 var(--brand);
}
.plus {
  position: absolute;
  left: 50%;
  top: 22px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1.5px solid var(--brand);
  background: var(--surface);
  color: var(--brand-text);
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.h-out.vue-flow__handle:hover .plus { background: var(--brand); color: var(--brand-ink); }
</style>
