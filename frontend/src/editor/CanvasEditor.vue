<script setup>
// Canvas editor for the variants "Canvas" (popover) and "Canvas + paneel" (inspector). Steps are
// not linked in this feature (FR-08 is out of scope): no edges and no connection handles.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { useEditor } from './context'
import { autoLayout, findNode, NODE_W } from '../lib/course'
import Icon from '../components/Icon.vue'
import VideoNode from './VideoNode.vue'
import QuestionNode from './QuestionNode.vue'
import NodeModal from './NodeModal.vue'
import Inspector from './Inspector.vue'

const props = defineProps({ mode: { type: String, default: 'inspector' } })
const ed = useEditor()
const flowId = 'course-flow-' + ed.course.id
const { screenToFlowCoordinate, setCenter, fitView, zoomIn, zoomOut, onInit, getViewport, setViewport } = useVueFlow(flowId)
const wrap = ref(null)

const nodes = computed(() =>
  ed.course.nodes.map((n) => ({ id: n.id, type: n.type, position: { x: n.x, y: n.y }, data: { node: n }, selected: ed.selectedId === n.id })),
)

function centerOn(id, duration = 300) {
  const n = findNode(ed.course, id)
  if (n) setCenter(n.x + NODE_W[n.type] / 2, n.y + 100, { zoom: 0.9, duration })
}

// Start view: fit everything, unless that makes the blocks too small; then start at the start step.
onInit(() =>
  setTimeout(async () => {
    const r = ed.focusRequest
    if (r && Date.now() - r.t < 3000) return centerOn(r.id, 0)
    await fitView({ padding: 0.2, maxZoom: 1 })
    if (getViewport().zoom >= 0.75 || !wrap.value) return
    const start = findNode(ed.course, ed.course.startId) ?? ed.course.nodes[0]
    if (!start) return
    const z = 0.85
    const box = wrap.value.getBoundingClientRect()
    setViewport({ x: box.width / 2 - (start.x + NODE_W[start.type] / 2) * z, y: 60 - start.y * z, zoom: z })
  }, 30),
)
watch(() => ed.focusRequest, (r) => r && centerOn(r.id))

function onNodeClick({ node }) {
  if (props.mode === 'popover') ed.open(node.id)
  else ed.select(node.id)
}
function onDragStop(e) {
  for (const fn of e.nodes ?? [e.node]) {
    const n = findNode(ed.course, fn.id)
    if (n) {
      n.x = Math.round(fn.position.x)
      n.y = Math.round(fn.position.y)
    }
  }
}

function afterCreate(n) {
  props.mode === 'popover' ? ed.open(n.id) : ed.select(n.id)
}
function addAtCenter(type) {
  const box = wrap.value.getBoundingClientRect()
  const p = screenToFlowCoordinate({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  afterCreate(ed.addNode(type, { x: Math.round(p.x - 110), y: Math.round(p.y - 90) }))
}
/** "Canvas ordenen": the blocks under each other in list order (research R9). */
function tidy() {
  autoLayout(ed.course)
  setTimeout(() => fitView({ padding: 0.2, duration: 300, maxZoom: 1 }), 30)
}

function onKey(e) {
  if (e.target.closest('input, textarea, select, [contenteditable]') || ed.modalId) return
  if ((e.key === 'Delete' || e.key === 'Backspace') && ed.selectedId) {
    ed.removeNode(ed.selectedId)
    e.preventDefault()
  }
  if (e.key === 'Escape') ed.clearSelection()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const selectedNode = computed(() => (ed.selectedId ? findNode(ed.course, ed.selectedId) : null))
</script>

<template>
  <div class="layout" :class="[mode, { 'has-panel': mode === 'inspector' && selectedNode }]">
    <div ref="wrap" class="canvas">
      <VueFlow
        :id="flowId"
        :nodes="nodes"
        :min-zoom="0.3"
        :max-zoom="1.5"
        :delete-key-code="null"
        :nodes-connectable="false"
        :zoom-on-double-click="false"
        @node-click="onNodeClick"
        @node-drag-stop="onDragStop"
        @pane-click="ed.clearSelection()"
      >
        <template #node-video="{ data }"><VideoNode :node="data.node" /></template>
        <template #node-question="{ data }"><QuestionNode :node="data.node" /></template>
        <Background :gap="24" :size="1.4" pattern-color="var(--dot)" />
        <MiniMap v-if="ed.course.nodes.length > 6" pannable zoomable node-color="#c9cdd2" mask-color="rgba(240,241,243,.7)" />
      </VueFlow>

      <div class="tools left">
        <button class="btn" @click="addAtCenter('video')"><Icon name="plus" :size="15" />Video</button>
        <button class="btn" @click="addAtCenter('question')"><Icon name="plus" :size="15" />Vraag</button>
      </div>
      <div class="tools right">
        <button class="icon-btn" title="Inzoomen" @click="zoomIn({ duration: 150 })"><Icon name="zoomin" /></button>
        <button class="icon-btn" title="Uitzoomen" @click="zoomOut({ duration: 150 })"><Icon name="zoomout" /></button>
        <button class="icon-btn" title="Alles in beeld" @click="fitView({ padding: 0.2, duration: 300, maxZoom: 1 })"><Icon name="fit" /></button>
        <button class="icon-btn" title="Canvas ordenen" @click="tidy"><Icon name="layout" /></button>
      </div>

    </div>

    <Inspector v-if="mode === 'inspector' && selectedNode" class="side" :node="selectedNode" />
    <NodeModal v-if="mode === 'popover' && ed.modalId" :node-id="ed.modalId" @close="ed.modalId = null" />
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(0, 1fr); height: 100%; min-height: 0; }
.layout.has-panel { grid-template-columns: minmax(0, 1fr) 360px; }
.canvas { position: relative; min-height: 0; height: 100%; background: var(--bg); }
.side { min-height: 0; overflow: auto; }
.tools { position: absolute; bottom: 16px; display: flex; gap: 6px; z-index: 5; }
.tools.left { left: 16px; }
.tools.left .btn { box-shadow: var(--shadow); }
.tools.right {
  right: 16px;
  gap: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  padding: 2px;
}
.layout:has(.vue-flow__minimap) .tools.right { bottom: 168px; }
@media (max-width: 1100px) {
  .layout.has-panel { grid-template-columns: minmax(0, 1fr) 320px; }
}
@media (max-width: 820px) {
  .layout.has-panel { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .layout.has-panel .side { max-height: 45vh; border-top: 1px solid var(--line); border-left: 0; }
}
</style>
