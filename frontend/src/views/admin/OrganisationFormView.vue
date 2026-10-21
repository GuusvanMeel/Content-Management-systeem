<script setup>
// Create mode (no id) and edit mode (with id), including the password reset (FR-004, FR-008, FR-009).
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api/client'
import { toast } from '../../lib/ui'

const props = defineProps({ id: { type: String, default: null } })
const router = useRouter()
const isEdit = computed(() => props.id !== null)

const form = reactive({ name: '', loginCode: '', password: '' })
const fieldErrors = ref({})
const error = ref('')
const busy = ref(false)
const original = ref(null)

// The code follows the name until the administrator edits it (FR-004a, contracts/ui.md).
const codeEdited = ref(false)
let suggestTimer

watch(
  () => form.name,
  (name) => {
    if (isEdit.value || codeEdited.value) return
    clearTimeout(suggestTimer)
    suggestTimer = setTimeout(async () => {
      if (!name.trim()) return
      try {
        const { loginCode } = await api(`/api/admin/organisations/code-suggestion?name=${encodeURIComponent(name)}`)
        if (!codeEdited.value && form.name === name) form.loginCode = loginCode
      } catch {
        // No suggestion possible for this name; the administrator types a code.
      }
    }, 300)
  },
)

onMounted(async () => {
  if (!isEdit.value) return
  try {
    original.value = await api(`/api/admin/organisations/${props.id}`)
    form.name = original.value.name
    form.loginCode = original.value.loginCode
  } catch (e) {
    error.value = e.message
  }
})

function showError(e) {
  fieldErrors.value = e.fields ?? {}
  error.value = Object.keys(fieldErrors.value).length ? '' : e.message
}

async function save() {
  fieldErrors.value = {}
  error.value = ''
  busy.value = true
  try {
    if (isEdit.value) {
      await api(`/api/admin/organisations/${props.id}`, {
        method: 'PATCH',
        body: { name: form.name, loginCode: form.loginCode },
      })
      toast('Wijzigingen opgeslagen')
    } else {
      await api('/api/admin/organisations', { method: 'POST', body: { ...form } })
      toast(`${form.name.trim()} is aangemaakt`)
    }
    router.push('/admin')
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}

// Password reset (edit mode only); running sessions stay valid (FR-010).
const newPassword = ref('')
const passwordError = ref('')
async function resetPassword() {
  passwordError.value = ''
  busy.value = true
  try {
    await api(`/api/admin/organisations/${props.id}/password`, { method: 'PUT', body: { password: newPassword.value } })
    newPassword.value = ''
    toast('Nieuw wachtwoord ingesteld')
  } catch (e) {
    passwordError.value = e.fields?.password ?? e.message
  } finally {
    busy.value = false
  }
}

const codeChanged = computed(
  () => isEdit.value && original.value && form.loginCode.trim().toUpperCase() !== original.value.loginCode,
)
</script>

<template>
  <div class="page narrow">
    <div class="page-head">
      <h1>{{ isEdit ? 'Organisatie wijzigen' : 'Nieuwe organisatie' }}</h1>
    </div>

    <form class="card" novalidate @submit.prevent="save">
      <div class="field">
        <label for="org-name">Naam</label>
        <input id="org-name" v-model="form.name" class="input" :class="{ invalid: fieldErrors.name }" maxlength="255" required autofocus />
        <span v-if="fieldErrors.name" class="hint err">{{ fieldErrors.name }}</span>
      </div>

      <div class="field">
        <label for="org-code">Organisatiecode</label>
        <input
          id="org-code"
          v-model="form.loginCode"
          class="input"
          :class="{ invalid: fieldErrors.loginCode }"
          maxlength="50"
          autocapitalize="characters"
          required
          @input="codeEdited = true"
        />
        <span v-if="fieldErrors.loginCode" class="hint err">{{ fieldErrors.loginCode }}</span>
        <span v-else-if="codeChanged" class="hint">Na het opslaan wordt de organisatie uitgelogd en werkt alleen de nieuwe code.</span>
        <span v-else-if="!isEdit" class="hint">Wordt voorgesteld op basis van de naam; je kunt de code aanpassen.</span>
      </div>

      <div v-if="!isEdit" class="field">
        <label for="org-password">Wachtwoord</label>
        <input id="org-password" v-model="form.password" type="password" class="input" :class="{ invalid: fieldErrors.password }" autocomplete="new-password" required />
        <span v-if="fieldErrors.password" class="hint err">{{ fieldErrors.password }}</span>
        <span v-else class="hint">Minimaal 10 tekens. Geef de code en het wachtwoord zelf door aan de organisatie.</span>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="buttons">
        <button class="btn btn-primary" :disabled="busy">{{ isEdit ? 'Opslaan' : 'Aanmaken' }}</button>
        <RouterLink to="/admin" class="btn btn-ghost">Annuleren</RouterLink>
      </div>
    </form>

    <form v-if="isEdit" class="card" novalidate @submit.prevent="resetPassword">
      <h2>Wachtwoord opnieuw instellen</h2>
      <p class="muted">Ingelogde docenten blijven ingelogd; het nieuwe wachtwoord geldt bij de volgende keer inloggen.</p>
      <div class="field">
        <label for="org-new-password">Nieuw wachtwoord</label>
        <input id="org-new-password" v-model="newPassword" type="password" class="input" :class="{ invalid: passwordError }" autocomplete="new-password" required />
        <span v-if="passwordError" class="hint err">{{ passwordError }}</span>
        <span v-else class="hint">Minimaal 10 tekens.</span>
      </div>
      <div><button class="btn" :disabled="busy">Wachtwoord instellen</button></div>
    </form>
  </div>
</template>

<style scoped>
.buttons { display: flex; gap: 8px; }
.buttons a { text-decoration: none; }
</style>
