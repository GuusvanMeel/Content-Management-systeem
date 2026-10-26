<script setup>
// A connection on the canvas (specs/005 FR-019), from the prototype. Answers carry their letter in
// the colour of that letter; connections of a video are neutral. Connections into the same step
// run in their own lane. Hover or selection brings the connection to the front and dims the rest
// (verbeterronde 005, punt 4). Click selects it; Delete/Backspace or the button removes it.
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, getBezierPath } from '@vue-flow/core'
import { useEditor } from './context'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  id: String,
  sourceX: Number,
  sourceY: Number,
  targetX: Number,
  targetY: Number,
  sourcePosition: String,
  targetPosition: String,
  data: Object,
  markerEnd: String,
})
const ed = useEditor()
const selected = computed(() => ed.selectedEdge === props.id)
const focused = computed(() => ed.focusEdge === props.id)
const dimmed = computed(() => !!ed.focusEdge && !focused.value)
const offset = computed(() => props.data.offset ?? 0)
// A connection that points back up is a loop: it curves around the blocks (the loop indication).
const isLoop = computed(() => props.targetY < props.sourceY + 20)
const path = computed(() => {
  const geometry = { ...props, targetX: props.targetX + offset.value }
  if (isLoop.value) return getBezierPath({ ...geometry, curvature: 0.6 })
  return getSmoothStepPath({
    ...geometry,
    borderRadius: 12,
    offset: 16,
    centerY: (props.sourceY + props.targetY) / 2 + offset.value * 0.6,
  })
})
const style = computed(() => ({
  stroke: props.data.colour,
  strokeWidth: focused.value ? 3.5 : 2,
  opacity: dimmed.value ? 0.2 : 1,
}))
function remove() {
  ed.disconnect(props.data.source, props.data.handle)
  ed.selectedEdge = null
}
</script>

<template>
  <BaseEdge :id="id" :path="path[0]" :marker-end="markerEnd" :interaction-width="16" :style="style" />
  <EdgeLabelRenderer>
    <span
      v-if="data.letter && !selected"
      class="letter nodrag nopan"
      :class="{ dimmed, focused }"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)`, borderColor: data.colour, color: data.colour }"
      :data-letter="data.letter"
    >{{ data.letter }}<template v-if="isLoop"> ↺</template></span>
    <span
      v-else-if="isLoop && !selected"
      class="letter loop nodrag nopan"
      :class="{ dimmed }"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)` }"
      title="Gaat terug naar een eerder onderdeel"
    >↺</span>
    <button
      v-if="selected"
      class="del nodrag nopan"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)` }"
      @click.stop="remove"
    >
      Verbinding verwijderen
    </button>
  </EdgeLabelRenderer>
</template>

<style scoped>
.letter {
  position: absolute;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface);
  border: 1.5px solid var(--line-strong);
  color: var(--fg);
  pointer-events: none;
  transition: opacity 0.12s;
}
.letter.loop { color: var(--muted); }
.letter.dimmed { opacity: 0.25; }
.letter.focused { box-shadow: 0 0 0 2px var(--surface), var(--shadow); }
.del {
  position: absolute;
  pointer-events: all;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--r-sm);
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--err);
  cursor: pointer;
  box-shadow: var(--shadow);
}
@media (prefers-reduced-motion: reduce) {
  .letter { transition: none; }
}
</style>
