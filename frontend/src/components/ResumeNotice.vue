<script setup>
// Notice about interrupted uploads that this browser started (FR-009a, research R14).
import { useUploads } from '../stores/uploads'

const uploads = useUploads()
</script>

<template>
  <ul v-if="uploads.interrupted.length" class="notices" aria-label="Onderbroken uploads">
    <li v-for="entry in uploads.interrupted" :key="entry.urlStorageKey" class="notice" data-test="resume-notice">
      <span>
        Je bent eerder begonnen met uploaden van <strong>{{ entry.name }}</strong>, {{ entry.percent }}% klaar.
        Kies het bestand opnieuw om verder te gaan, of verwijder het.
      </span>
      <button class="btn btn-sm" @click="uploads.discardInterrupted(entry)">Verwijderen</button>
    </li>
  </ul>
</template>

<style scoped>
.notices { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--r);
  background: var(--brand-soft);
  border: 1px solid color-mix(in srgb, var(--brand) 25%, transparent);
}
</style>
