<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { confirmDialog, toast } from '../../lib/ui'

const organisations = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  error.value = ''
  try {
    organisations.value = (await api('/api/admin/organisations')).organisations
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Asks for confirmation first; cancelling changes nothing (FR-011).
async function remove(organisation) {
  const ok = await confirmDialog({
    title: `${organisation.name} verwijderen?`,
    body: `De organisatie "${organisation.name}" kan daarna niet meer inloggen. De organisatiecode ${organisation.loginCode} blijft bezet.`,
    confirmLabel: 'Verwijderen',
    danger: true,
  })
  if (!ok) return
  try {
    await api(`/api/admin/organisations/${organisation.id}`, { method: 'DELETE' })
    toast(`${organisation.name} is verwijderd`)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Organisaties</h1>
      <RouterLink to="/admin/organisations/new" class="btn btn-primary">Nieuwe organisatie</RouterLink>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="muted">Laden…</p>
    <p v-else-if="organisations.length === 0" class="muted">Er zijn nog geen organisaties.</p>

    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>Naam</th><th>Organisatiecode</th><th class="actions"><span class="sr-only">Acties</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="o in organisations" :key="o.id">
            <td>{{ o.name }}</td>
            <td><code>{{ o.loginCode }}</code></td>
            <td class="actions">
              <div class="row-actions">
                <RouterLink :to="`/admin/organisations/${o.id}`" class="btn btn-sm">Wijzigen</RouterLink>
                <button class="btn btn-sm btn-danger" @click="remove(o)">Verwijderen</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page-head a, .actions a { text-decoration: none; }
.row-actions { display: flex; gap: 6px; justify-content: flex-end; }
</style>
