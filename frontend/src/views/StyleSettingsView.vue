<script setup>
// House style of the logged-in organisation (FR-023 – FR-025). Changes apply immediately (SC-006).
import { computed, ref, watch } from 'vue'
import { useAuth } from '../stores/auth'
import { useStyle } from '../stores/style'
import { confirmDialog, toast } from '../lib/ui'
import OrgLogo from '../components/OrgLogo.vue'

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const HEX = /^#[0-9a-fA-F]{6}$/

const auth = useAuth()
const store = useStyle()
const current = computed(() => store.style)

const primary = ref('')
const secondary = ref('')
const colourError = ref('')
const logoError = ref('')
const busy = ref(false)
const logoInput = ref(null)

watch(
  current,
  (s) => {
    if (!s) return
    primary.value = s.primaryColour.value
    secondary.value = s.secondaryColour.value
  },
  { immediate: true },
)

async function run(action, errorRef) {
  errorRef.value = ''
  busy.value = true
  try {
    await action()
    return true
  } catch (e) {
    errorRef.value = Object.values(e.fields ?? {})[0] ?? e.message
    return false
  } finally {
    busy.value = false
  }
}

async function saveColours() {
  if (!HEX.test(primary.value) || !HEX.test(secondary.value)) {
    colourError.value = 'Gebruik een kleur in de vorm #RRGGBB.'
    return
  }
  // Only send colours that changed, so an untouched default stays a default.
  const changes = {}
  if (primary.value.toUpperCase() !== current.value.primaryColour.value) changes.primaryColour = primary.value
  if (secondary.value.toUpperCase() !== current.value.secondaryColour.value) changes.secondaryColour = secondary.value
  const ok = await run(() => store.saveColours(changes), colourError)
  if (ok) toast('Kleuren opgeslagen')
}

async function resetColour(key) {
  if (await run(() => store.saveColours({ [key]: null }), colourError)) toast('Standaardkleur hersteld')
}

async function onLogo(event) {
  const file = event.target.files[0]
  event.target.value = ''
  logoError.value = ''
  if (!file) return
  if (file.size > LOGO_MAX_BYTES) {
    logoError.value = 'Het logo mag maximaal 2 MB zijn.'
    return
  }
  if (await run(() => store.uploadLogo(file), logoError)) toast('Logo opgeslagen')
}

async function removeLogo() {
  if (await run(() => store.removeLogo(), logoError)) toast('Logo verwijderd')
}

async function resetAll() {
  const ok = await confirmDialog({
    title: 'Terug naar de standaardhuisstijl?',
    body: 'Je eigen kleuren en logo worden verwijderd.',
    confirmLabel: 'Terugzetten',
    danger: true,
  })
  if (ok && (await run(() => store.resetStyle(), colourError))) toast('Standaardhuisstijl hersteld')
}
</script>

<template>
  <div class="page narrow">
    <div class="page-head"><h1>Huisstijl</h1></div>

    <section v-if="current" class="card">
      <h2>Kleuren</h2>
      <p class="muted">Zonder eigen kleuren gebruikt het CMS de standaardkleuren.</p>

      <div class="row">
        <div class="field">
          <label for="c-primary">Primaire kleur</label>
          <div class="color">
            <input id="c-primary" v-model="primary" type="color" aria-label="Primaire kleur kiezen" />
            <input id="c-primary-hex" v-model="primary" class="input" maxlength="7" aria-label="Primaire kleur als code" />
          </div>
          <button v-if="!current.primaryColour.isDefault" class="link-btn" :disabled="busy" @click="resetColour('primaryColour')">
            Standaardkleur gebruiken
          </button>
        </div>
        <div class="field">
          <label for="c-secondary">Secundaire kleur</label>
          <div class="color">
            <input id="c-secondary" v-model="secondary" type="color" aria-label="Secundaire kleur kiezen" />
            <input id="c-secondary-hex" v-model="secondary" class="input" maxlength="7" aria-label="Secundaire kleur als code" />
          </div>
          <button v-if="!current.secondaryColour.isDefault" class="link-btn" :disabled="busy" @click="resetColour('secondaryColour')">
            Standaardkleur gebruiken
          </button>
        </div>
      </div>
      <p v-if="colourError" class="error" role="alert">{{ colourError }}</p>
      <div><button class="btn btn-primary" :disabled="busy" @click="saveColours">Kleuren opslaan</button></div>
    </section>

    <section v-if="current" class="card">
      <h2>Logo</h2>
      <p class="muted">PNG, JPG of SVG, maximaal 2 MB.</p>
      <div class="logo-row">
        <OrgLogo :org="auth.organisation" :branding="{ logo: current.logo.url }" :size="48" />
        <button class="btn btn-sm" :disabled="busy" @click="logoInput.click()">Uploaden</button>
        <button v-if="!current.logo.isDefault" class="btn btn-sm btn-ghost" :disabled="busy" @click="removeLogo">Logo verwijderen</button>
        <input id="logo-file" ref="logoInput" type="file" accept=".png,.jpg,.jpeg,.svg" hidden @change="onLogo" />
      </div>
      <p v-if="logoError" class="error" role="alert">{{ logoError }}</p>
    </section>

    <div v-if="current">
      <button class="btn btn-sm btn-ghost" :disabled="busy" @click="resetAll">Terug naar standaard</button>
    </div>
  </div>
</template>

<style scoped>
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.color { display: flex; gap: 8px; }
.color input[type='color'] { width: 42px; height: 38px; padding: 2px; border: 1px solid var(--line-strong); border-radius: var(--r-sm); background: var(--surface); cursor: pointer; }
.logo-row { display: flex; align-items: center; gap: 12px; }
.link-btn { justify-self: start; border: 0; background: none; padding: 0; color: var(--brand-text); font: inherit; font-size: 0.85rem; cursor: pointer; text-decoration: underline; }
@media (max-width: 520px) { .row { grid-template-columns: 1fr; } }
</style>
