<script setup>
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
// links that point back up read better as a curve
const path = computed(() =>
  props.targetY < props.sourceY + 20 ? getBezierPath({ ...props, curvature: 0.6 }) : getSmoothStepPath({ ...props, borderRadius: 12, offset: 16 }),
)
function remove() {
  ed.disconnect(props.data.source, props.data.handle)
  ed.selectedEdge = null
}
</script>

<template>
  <BaseEdge :id="id" :path="path[0]" :marker-end="markerEnd" :interaction-width="16" />
  <EdgeLabelRenderer>
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
</style>
