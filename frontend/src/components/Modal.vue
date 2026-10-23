<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { ui } from '../lib/ui'
import Icon from './Icon.vue'
defineProps({ title: String, width: { type: String, default: '520px' } })
const emit = defineEmits(['close'])
// While a confirmation is open on top, Escape belongs to that confirmation.
const onKey = (e) => e.key === 'Escape' && !ui.confirm && emit('close')
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @mousedown.self="emit('close')">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ width: `min(${width}, 100%)` }">
        <div class="modal-head">
          <slot name="head"><h2>{{ title }}</h2></slot>
          <button class="icon-btn" aria-label="Sluiten" @click="emit('close')"><Icon name="x" /></button>
        </div>
        <div class="modal-body"><slot /></div>
        <div v-if="$slots.foot" class="modal-foot"><slot name="foot" /></div>
      </div>
    </div>
  </Teleport>
</template>
