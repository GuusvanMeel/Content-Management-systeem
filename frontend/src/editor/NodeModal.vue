<script setup>
// Variant "Canvas": edit dialog that opens when you click a block.
import { computed } from 'vue'
import { useEditor } from './context'
import { findNode } from '../lib/course'
import Modal from '../components/Modal.vue'
import NodeEditForm from './NodeEditForm.vue'

const props = defineProps({ nodeId: String })
const emit = defineEmits(['close'])
const ed = useEditor()
const node = computed(() => findNode(ed.course, props.nodeId))
</script>

<template>
  <Modal v-if="node" :title="node.type === 'video' ? 'Video-onderdeel' : 'Vraag'" width="480px" @close="emit('close')">
    <NodeEditForm :node="node" @deleted="emit('close')" />
    <template #foot>
      <button class="btn btn-primary" @click="emit('close')">Klaar</button>
    </template>
  </Modal>
</template>
