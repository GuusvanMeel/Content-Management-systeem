import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, vi } from 'vitest'

// Fresh store state and a mocked fetch for every test.
beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.fetch = vi.fn()
})
