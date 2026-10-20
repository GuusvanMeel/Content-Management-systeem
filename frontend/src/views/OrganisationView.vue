<script setup>
import { ref, computed } from 'vue'
import { useApp } from '../stores/app'
import { DEFAULT_BRANDING } from '../data/seed'
import { confirmDialog, toast } from '../lib/ui'
import OrgLogo from '../components/OrgLogo.vue'

const app = useApp()
const b = computed(() => app.org.branding ?? DEFAULT_BRANDING)
const logoInput = ref(null)
const logoError = ref('')
const HEX = /^#[0-9a-fA-F]{6}$/

function setColor(key, value) {
  if (HEX.test(value)) app.updateBranding({ [key]: value })
}
function onLogo(e) {
  const file = e.target.files[0]
  e.target.value = ''
  logoError.value = ''
  if (!file) return
  if (!/image\/(png|jpeg|svg\+xml|webp)/.test(file.type)) return (logoError.value = 'Gebruik een PNG, JPG, WebP of SVG.')
  if (file.size > 600_000) return (logoError.value = 'Het logo mag maximaal 0,6 MB zijn.')
  const r = new FileReader()
  r.onload = () => app.updateBranding({ logo: r.result, logoOnBrand: null })
  r.readAsDataURL(file)
}
async function reset() {
  const ok = await confirmDialog({
    title: 'Voorbeeldgegevens herstellen?',
    body: 'Alle cursussen, video’s en huisstijlen in dit prototype gaan terug naar het begin.',
    confirmLabel: 'Herstellen',
    danger: true,
  })
  if (ok) {
    app.resetDemo()
    toast('Voorbeeldgegevens hersteld')
  }
}
</script>

<template>
  <div class="page narrow">
    <div class="page-head"><h1>{{ app.org.name }}</h1></div>

    <section class="card">
      <h2>Koppelcode</h2>
      <p class="muted">Nieuwe collega’s vullen deze code in bij het aanmaken van een account.</p>
      <code class="code">{{ app.org.code }}</code>
    </section>

    <section class="card">
      <h2>Huisstijl</h2>
      <p class="muted">Zonder eigen huisstijl gebruikt het systeem de standaardkleuren.</p>

      <div class="row">
        <div class="field">
          <label for="c-primary">Primaire kleur</label>
          <div class="color">
            <input id="c-primary" type="color" :value="b.primary" @input="setColor('primary', $event.target.value)" />
            <input id="c-primary-hex" class="input" :value="b.primary" maxlength="7" @change="setColor('primary', $event.target.value)" />
          </div>
        </div>
        <div class="field">
          <label for="c-secondary">Secundaire kleur</label>
          <div class="color">
            <input id="c-secondary" type="color" :value="b.secondary" @input="setColor('secondary', $event.target.value)" />
            <input id="c-secondary-hex" class="input" :value="b.secondary" maxlength="7" @change="setColor('secondary', $event.target.value)" />
          </div>
        </div>
      </div>

      <div class="field">
        <span class="label">Logo</span>
        <div class="logo-row">
          <OrgLogo :org="app.org" :branding="app.org.branding" :size="48" />
          <button class="btn btn-sm" @click="logoInput.click()">Uploaden</button>
          <button v-if="b.logo" class="btn btn-sm btn-ghost" @click="app.updateBranding({ logo: null, logoOnBrand: null })">Weghalen</button>
          <input id="logo-file" ref="logoInput" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden @change="onLogo" />
        </div>
        <span v-if="logoError" class="hint err">{{ logoError }}</span>
      </div>

      <div>
        <button class="btn btn-sm btn-ghost" :disabled="!app.org.branding" @click="app.resetBranding()">Standaard huisstijl gebruiken</button>
      </div>
    </section>

    <button class="btn btn-sm btn-ghost reset" @click="reset">Voorbeeldgegevens herstellen</button>
  </div>
</template>

<style scoped>
.narrow { max-width: 640px; }
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 20px 24px;
  display: grid;
  gap: 14px;
}
.card > p { margin-top: -8px; }
.code { font-size: 1.15rem; letter-spacing: 0.06em; user-select: all; justify-self: start; padding: 4px 10px; background: var(--brand-soft); color: var(--brand-text); border-radius: var(--r-sm); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.color { display: flex; gap: 8px; }
.color input[type='color'] { width: 42px; height: 38px; padding: 2px; border: 1px solid var(--line-strong); border-radius: var(--r-sm); background: var(--surface); cursor: pointer; }
.logo-row { display: flex; align-items: center; gap: 12px; }
.reset { justify-self: start; color: var(--muted); }
@media (max-width: 520px) { .row { grid-template-columns: 1fr; } }
</style>
