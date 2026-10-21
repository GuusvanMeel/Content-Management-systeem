<script setup>
import { ui, dismiss } from './lib/ui'
</script>

<template>
  <RouterView />

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
</template>

<style scoped>
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
</style>
