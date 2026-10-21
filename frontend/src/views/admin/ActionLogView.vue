<script setup>
// Read-only log of administrator actions, newest first (FR-028).
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api/client'

const ACTION_LABELS = {
  create: 'Aangemaakt',
  update: 'Gewijzigd',
  delete: 'Verwijderd',
  passwordReset: 'Wachtwoord gereset',
}
const FIELD_LABELS = { name: 'Naam', loginCode: 'Code' }

const entries = ref([])
const page = ref(1)
const total = ref(0)
const pageSize = ref(50)
const error = ref('')
const loading = ref(true)

const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })

async function load(target = 1) {
  error.value = ''
  loading.value = true
  try {
    const data = await api(`/api/admin/action-log?page=${target}`)
    entries.value = data.entries
    page.value = data.page
    total.value = data.total
    pageSize.value = data.pageSize
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function describe(entry) {
  const details = entry.details ?? {}
  if (entry.action === 'create') return `${details.name} (${details.loginCode})`
  return Object.entries(details)
    .filter(([, change]) => change && typeof change === 'object' && 'old' in change)
    .map(([field, change]) => `${FIELD_LABELS[field] ?? field}: ${change.old} → ${change.new}`)
    .join(', ')
}

onMounted(() => load())
</script>

<template>
  <div class="page">
    <div class="page-head"><h1>Logboek</h1></div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="!loading && entries.length === 0" class="muted">Er zijn nog geen acties vastgelegd.</p>

    <div v-if="entries.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>Datum en tijd</th><th>Beheerder</th><th>Actie</th><th>Organisatie</th><th>Details</th></tr>
        </thead>
        <tbody>
          <tr v-for="e in entries" :key="e.id">
            <td>{{ dateFormat.format(new Date(e.createdAt)) }}</td>
            <td>{{ e.administrator }}</td>
            <td>{{ ACTION_LABELS[e.action] ?? e.action }}</td>
            <td>{{ e.organisation.name }}<span v-if="e.organisation.deleted" class="muted"> (verwijderd)</span></td>
            <td class="muted">{{ describe(e) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pages > 1" class="pager">
      <button class="btn btn-sm" :disabled="page <= 1 || loading" @click="load(page - 1)">Vorige</button>
      <span class="muted small">Pagina {{ page }} van {{ pages }}</span>
      <button class="btn btn-sm" :disabled="page >= pages || loading" @click="load(page + 1)">Volgende</button>
    </div>
  </div>
</template>

<style scoped>
.pager { display: flex; align-items: center; gap: 12px; }
</style>
