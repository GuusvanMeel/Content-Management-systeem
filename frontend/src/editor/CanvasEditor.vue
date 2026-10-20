<script setup>
// Canvas editor for the variants "Canvas" (popover) and "Canvas + paneel" (inspector).
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { useEditor } from './context'
import { outgoing, positionBelow, findNode, NODE_W } from '../lib/course'
import Icon from '../components/Icon.vue'
import VideoNode from './VideoNode.vue'
import QuestionNode from './QuestionNode.vue'
import CourseEdge from './CourseEdge.vue'
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
const edges = computed(() =>
  ed.course.nodes.flatMap((n) =>
    outgoing(n).map((o) => ({
      id: `${n.id}__${o.handle}`,
      source: n.id,
      target: o.target,
      sourceHandle: o.handle,
      targetHandle: 'in',
      type: 'course',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#c9cdd2' },
      data: { source: n.id, handle: o.handle },
    })),
  ),
)

function centerOn(id, duration = 300) {
  const n = findNode(ed.course, id)
  if (n) setCenter(n.x + NODE_W[n.type] / 2, n.y + 100, { zoom: 0.9, duration })
}

// Start view: fit everything, unless that makes the blocks too small; then start at the top of the route.
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

function onNodeClick({ node, event }) {
  if (event?.target?.closest?.('.vue-flow__handle')) return
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

// Connecting: drag from a handle onto a block, or onto empty space to create a new part there.
let pending = null
let lastConnectEnd = 0
const menu = ref(null)
const connecting = ref(false) // while dragging a connection, whole blocks become drop targets
function onConnectStart({ nodeId, handleId, event }) {
  connecting.value = true
  pending = { source: nodeId, handle: handleId, connected: false, x: event?.clientX, y: event?.clientY }
}
function onConnect(c) {
  if (pending) pending.connected = true
  ed.connect(c.source, c.sourceHandle, c.target)
}
function onConnectEnd(event) {
  connecting.value = false
  lastConnectEnd = performance.now()
  const p = pending
  pending = null
  if (!p || p.connected || !event) return
  const pt = event.changedTouches ? event.changedTouches[0] : event
  const moved = Math.hypot(pt.clientX - (p.x ?? pt.clientX), pt.clientY - (p.y ?? pt.clientY)) > 12
  const box = wrap.value.getBoundingClientRect()
  const flow = moved ? screenToFlowCoordinate({ x: pt.clientX, y: pt.clientY }) : null
  menu.value = {
    x: Math.min(pt.clientX - box.left, box.width - 190),
    y: Math.min(pt.clientY - box.top, box.height - 110),
    pos: flow ? { x: flow.x - NODE_W.video / 2, y: flow.y } : positionBelow(ed.course, findNode(ed.course, p.source), p.handle),
    source: p.source,
    handle: p.handle,
  }
}
function createFromMenu(type) {
  const m = menu.value
  menu.value = null
  afterCreate(ed.addLinked(m.source, m.handle, type, m.pos))
}
function onPaneClick() {
  if (performance.now() - lastConnectEnd < 300) return // releasing a connection also clicks the pane
  ed.clearSelection()
  menu.value = null
}
const isValidConnection = (c) => !(findNode(ed.course, c.source)?.type === 'video' && c.source === c.target)

function afterCreate(n) {
  props.mode === 'popover' ? ed.open(n.id) : ed.select(n.id)
}
function addAtCenter(type, extra) {
  const box = wrap.value.getBoundingClientRect()
  const p = screenToFlowCoordinate({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  afterCreate(ed.addNode(type, { x: Math.round(p.x - 110), y: Math.round(p.y - 90) }, extra))
}

function onKey(e) {
  if (e.target.closest('input, textarea, select, [contenteditable]') || ed.modalId) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (ed.selectedId) ed.removeNode(ed.selectedId)
    else if (ed.selectedEdge) {
      const [source, handle] = ed.selectedEdge.split('__')
      ed.disconnect(source, handle)
      ed.selectedEdge = null
    } else return
    e.preventDefault()
  }
  if (e.key === 'Escape') {
    menu.value = null
    ed.clearSelection()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const selectedNode = computed(() => (ed.selectedId ? findNode(ed.course, ed.selectedId) : null))
</script>

<template>
  <div class="layout" :class="[mode, { 'has-panel': mode === 'inspector' && selectedNode }]">
    <div ref="wrap" class="canvas" :class="{ 'is-connecting': connecting }">
      <VueFlow
        :id="flowId"
        :nodes="nodes"
        :edges="edges"
        :min-zoom="0.3"
        :max-zoom="1.5"
        :delete-key-code="null"
        :connect-on-click="false"
        :connection-radius="40"
        connection-mode="strict"
        :is-valid-connection="isValidConnection"
        :zoom-on-double-click="false"
        @node-click="onNodeClick"
        @node-drag-stop="onDragStop"
        @edge-click="({ edge }) => ed.selectEdge(edge.id)"
        @pane-click="onPaneClick"
        @connect-start="onConnectStart"
        @connect="onConnect"
        @connect-end="onConnectEnd"
      >
        <template #node-video="{ data }"><VideoNode :node="data.node" /></template>
        <template #node-question="{ data }"><QuestionNode :node="data.node" /></template>
        <template #edge-course="edgeProps"><CourseEdge v-bind="edgeProps" /></template>
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
      </div>

      <div v-if="menu" class="menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" role="menu">
        <button role="menuitem" @click="createFromMenu('video')"><Icon name="film" :size="15" />Nieuw video-onderdeel</button>
        <button role="menuitem" @click="createFromMenu('question')"><Icon name="question" :size="15" />Nieuwe vraag</button>
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
.menu {
  position: absolute;
  z-index: 10;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  display: grid;
}
.menu button {
  display: flex;
  gap: 8px;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 8px 12px;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
}
.menu button:hover { background: var(--brand-soft); }
@media (max-width: 1100px) {
  .layout.has-panel { grid-template-columns: minmax(0, 1fr) 320px; }
}
@media (max-width: 820px) {
  .layout.has-panel { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .layout.has-panel .side { max-height: 45vh; border-top: 1px solid var(--line); border-left: 0; }
}
</style>
