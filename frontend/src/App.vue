<script setup>
import { watchEffect, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from './stores/app'
import { inkFor } from './lib/util'
import { ui, dismiss } from './lib/ui'
import Icon from './components/Icon.vue'
import OrgLogo from './components/OrgLogo.vue'

const app = useApp()
const route = useRoute()

// Apply the organisation's huisstijl (FR-06).
watchEffect(() => {
  const s = document.documentElement.style
  s.setProperty('--brand', app.branding.primary)
  s.setProperty('--brand-ink', inkFor(app.branding.primary))
  s.setProperty('--brand-2', app.branding.secondary)
  s.setProperty('--brand-2-ink', inkFor(app.branding.secondary))
})

const inEditor = computed(() => route.path.startsWith('/cursussen/'))
</script>

<template>
  <div class="shell" :class="{ 'in-editor': inEditor }">
    <header class="topbar">
      <div class="org">
        <OrgLogo :org="app.org" :branding="app.org.branding" :size="28" on-brand />
        <label class="org-select" title="Organisatie wisselen (alleen in het prototype)">
          <span class="sr-only">Organisatie</span>
          <select id="org-switch" v-model="app.currentOrgId">
            <option v-for="o in app.orgs" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
          <Icon name="down" :size="14" />
        </label>
      </div>
      <nav class="nav" aria-label="Hoofdmenu">
        <RouterLink to="/cursussen" :class="{ on: route.path.startsWith('/cursussen') }">Cursussen</RouterLink>
        <RouterLink to="/videos" active-class="on">Video’s</RouterLink>
        <RouterLink to="/organisatie" active-class="on">Organisatie</RouterLink>
      </nav>
    </header>

    <main class="main">
      <RouterView :key="app.currentOrgId" />
    </main>

    <div class="toasts" aria-live="polite">
      <div v-for="t in ui.toasts" :key="t.id" class="toast">
        <span>{{ t.message }}</span>
        <button v-if="t.action" class="toast-action" @click="t.action(); dismiss(t.id)">{{ t.actionLabel }}</button>
      </div>
    </div>

    <div v-if="ui.confirm" class="backdrop" @mousedown.self="ui.confirm.resolve(false)">
      <div class="modal" role="alertdialog" aria-modal="true" style="width: min(420px, 100%)">
        <div class="modal-head"><h2>{{ ui.confirm.title }}</h2></div>
        <div class="modal-body"><p class="muted">{{ ui.confirm.body }}</p></div>
        <div class="modal-foot">
          <button class="btn btn-ghost" @click="ui.confirm.resolve(false)">Annuleren</button>
          <button class="btn" :class="ui.confirm.danger ? 'btn-danger-solid' : 'btn-primary'" @click="ui.confirm.resolve(true)">
            {{ ui.confirm.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell { min-height: 100%; display: flex; flex-direction: column; }
.shell.in-editor { height: 100%; }
.topbar {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 0 20px;
  height: 56px;
  background: var(--brand);
  color: var(--brand-ink);
  flex-shrink: 0;
}
.org { display: flex; align-items: center; gap: 10px; min-width: 0; }
.org-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  padding-left: 12px;
  margin-left: 2px;
  border-left: 1px solid color-mix(in srgb, currentColor 35%, transparent);
}
.org-select select option { color: var(--fg); }
.org-select select {
  appearance: none;
  border: 0;
  background: transparent;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
  padding-right: 4px;
  max-width: 230px;
  field-sizing: content;
  text-overflow: ellipsis;
}
.nav { display: flex; gap: 4px; height: 100%; }
.nav a {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  text-decoration: none;
  color: inherit;
  opacity: 0.78;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  padding-top: 3px;
}
.nav a:hover { opacity: 1; }
.nav a.on { opacity: 1; border-bottom-color: var(--brand-2); }
.main { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.main > :deep(*) { flex: 1; min-height: 0; }
.toasts {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  gap: 8px;
  z-index: 80;
  max-width: calc(100% - 32px);
}
.toast {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--fg);
  color: #fff;
  padding: 10px 16px;
  border-radius: var(--r);
  box-shadow: var(--shadow-lg);
  font-size: 0.9rem;
}
.toast-action { border: 0; background: transparent; color: color-mix(in srgb, var(--brand) 45%, white); font-weight: 600; cursor: pointer; }
@media (max-width: 640px) {
  .topbar { gap: 12px; padding: 0 12px; }
  .org-select select { max-width: 120px; }
  .nav a { padding: 0 6px; font-size: 0.9rem; }
}
</style>
