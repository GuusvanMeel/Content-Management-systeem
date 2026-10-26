<script setup>
// Menu at a connection point (specs/005 FR-020, contracts/ui.md § Canvas): create a connected new
// step, choose an existing step, or remove the connection. Opens with one click or after dragging
// to an empty spot; Escape or a click outside closes it without a change.
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditor } from './context'
import { findNode, nodeLabel, targetOf } from '../lib/course'
import Icon from '../components/Icon.vue'

const props = defineProps({
  sourceId: { type: String, required: true },
  handle: { type: String, required: true },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
})
const emit = defineEmits(['create', 'choose', 'remove', 'close'])
const ed = useEditor()
const root = ref(null)
const query = ref('')
const SEARCH_FROM = 8

const source = computed(() => findNode(ed.course, props.sourceId))
const current = computed(() => targetOf(ed.course, props.sourceId, props.handle))
// A video cannot point to itself (FR-003); an answer may point to its own question.
const choices = computed(() =>
  ed.ordered
    .filter((n) => !(source.value?.type === 'video' && n.id === props.sourceId))
    .map((n) => ({ id: n.id, label: (n.type === 'question' ? 'Vraag: ' : '') + nodeLabel(n, ed.stepVideos) })),
)
const showSearch = computed(() => choices.value.length > SEARCH_FROM)
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? choices.value.filter((c) => c.label.toLowerCase().includes(q)) : choices.value
})

function onKey(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}
function onPointer(e) {
  if (root.value && !root.value.contains(e.target)) emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  // Registered after the click that opened the menu has finished.
  setTimeout(() => window.addEventListener('mousedown', onPointer), 0)
  nextTick(() => root.value?.querySelector('input, button')?.focus())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('mousedown', onPointer)
})
</script>

<template>
  <div ref="root" class="menu" :style="{ left: x + 'px', top: y + 'px' }" role="menu" data-test="connect-menu">
    <button role="menuitem" data-test="new-video" @click="emit('create', 'video')"><Icon name="film" :size="15" />Nieuw video-onderdeel</button>
    <button role="menuitem" data-test="new-question" @click="emit('create', 'question')"><Icon name="question" :size="15" />Nieuwe vraag</button>
    <template v-if="choices.length">
      <p class="group">Bestaand onderdeel</p>
      <input v-if="showSearch" v-model="query" class="input search" placeholder="Zoek een onderdeel" aria-label="Zoek een onderdeel" data-test="search" />
      <div class="existing">
        <button
          v-for="c in filtered"
          :key="c.id"
          role="menuitem"
          class="choice"
          :class="{ on: c.id === current }"
          data-test="existing"
          @click="emit('choose', c.id)"
        >{{ c.label }}</button>
        <p v-if="!filtered.length" class="muted small none">Geen onderdeel gevonden.</p>
      </div>
    </template>
    <button v-if="current" role="menuitem" class="danger" data-test="remove-connection" @click="emit('remove')">
      <Icon name="x" :size="15" />Verbinding weghalen
    </button>
  </div>
</template>

<style scoped>
.menu {
  position: absolute;
  z-index: 10;
  width: 240px;
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
}
.menu button:hover,
.menu button.on { background: var(--brand-soft); }
.group { margin: 6px 12px 2px; font-size: 0.75rem; font-weight: 600; color: var(--muted); }
.search { margin: 2px 6px 4px; min-height: 30px; padding: 4px 8px; }
.existing { max-height: 200px; overflow: auto; display: grid; }
.choice { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block !important; }
.none { padding: 4px 12px; }
.danger { color: var(--err); border-top: 1px solid var(--line) !important; border-radius: 0 0 5px 5px !important; }
</style>
