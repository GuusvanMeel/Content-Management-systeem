<script setup>
// Variant "Canvas + paneel": side panel that appears when a block is selected.
import { useEditor } from './context'
import Icon from '../components/Icon.vue'
import NodeEditForm from './NodeEditForm.vue'

defineProps({ node: Object })
const ed = useEditor()
</script>

<template>
  <aside class="panel">
    <div class="head">
      <h2>{{ node.type === 'video' ? 'Video-onderdeel' : 'Vraag' }}</h2>
      <button class="icon-btn" aria-label="Sluiten" @click="ed.clearSelection()"><Icon name="x" /></button>
    </div>
    <NodeEditForm :key="node.id" :node="node" />
  </aside>
</template>

<style scoped>
.panel {
  background: var(--surface);
  border-left: 1px solid var(--line);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.head { display: flex; align-items: center; justify-content: space-between; min-height: 34px; }
.head h2 { color: var(--brand-text); }
</style>
