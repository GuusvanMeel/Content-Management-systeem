<script setup>
// Centred message when the server refuses a video after the upload (FR-014, contracts/ui.md).
// Shown on every page, one rejection at a time.
import { computed } from 'vue'
import { useUploads } from '../stores/uploads'
import Modal from './Modal.vue'

const uploads = useUploads()
const current = computed(() => uploads.rejections[0] ?? null)
</script>

<template>
  <Modal v-if="current" title="Video niet toegevoegd" @close="uploads.dismissRejection()">
    <p class="file">{{ current.fileName }}</p>
    <p class="message" role="alert">{{ current.message }}</p>
    <template #foot>
      <button class="btn btn-primary" @click="uploads.dismissRejection()">OK</button>
    </template>
  </Modal>
</template>

<style scoped>
.file { margin: 0 0 8px; font-weight: 500; overflow-wrap: anywhere; }
.message { margin: 0; color: var(--err); }
</style>
