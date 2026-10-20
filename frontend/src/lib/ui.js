import { reactive } from 'vue'

/** Tiny global UI state: toasts and an in-page confirm dialog (window.confirm isn't available everywhere). */
export const ui = reactive({ toasts: [], confirm: null })

export function toast(message, { action, actionLabel, timeout = 4000 } = {}) {
  const t = { id: Math.random(), message, action, actionLabel }
  ui.toasts.push(t)
  setTimeout(() => dismiss(t.id), timeout)
}
export function dismiss(id) {
  const i = ui.toasts.findIndex((t) => t.id === id)
  if (i >= 0) ui.toasts.splice(i, 1)
}

export function confirmDialog({ title, body, confirmLabel = 'Bevestigen', danger = false }) {
  return new Promise((resolve) => {
    ui.confirm = {
      title, body, confirmLabel, danger,
      resolve: (v) => {
        ui.confirm = null
        resolve(v)
      },
    }
  })
}
