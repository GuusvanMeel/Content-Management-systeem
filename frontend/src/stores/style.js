import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '../api/client'
import { defaultStyle } from '../config/defaultStyle'
import { inkFor } from '../lib/util'

function setColours(primary, secondary) {
  const s = document.documentElement.style
  s.setProperty('--brand', primary)
  s.setProperty('--brand-ink', inkFor(primary))
  s.setProperty('--brand-2', secondary)
  s.setProperty('--brand-2-ink', inkFor(secondary))
}

/** The effective house style of the logged-in organisation (FR-023 – FR-026). */
export const useStyle = defineStore('style', () => {
  const style = ref(null)
  const logoUrl = computed(() => style.value?.logo.url ?? defaultStyle.logoUrl)

  function applyStyle() {
    if (!style.value) return applyDefault()
    setColours(style.value.primaryColour.value, style.value.secondaryColour.value)
  }

  /** Used on login pages, in the admin environment and after logging out (FR-026). */
  function applyDefault() {
    style.value = null
    setColours(defaultStyle.primaryColour, defaultStyle.secondaryColour)
  }

  async function update(request) {
    style.value = await request
    applyStyle()
  }

  const loadStyle = () => update(api('/api/organisation/style'))
  const saveColours = (colours) => update(api('/api/organisation/style', { method: 'PUT', body: colours }))
  const removeLogo = () => update(api('/api/organisation/style/logo', { method: 'DELETE' }))
  const resetStyle = () => update(api('/api/organisation/style', { method: 'DELETE' }))
  function uploadLogo(file) {
    const formData = new FormData()
    formData.append('logo', file)
    return update(api('/api/organisation/style/logo', { method: 'PUT', formData }))
  }

  return { style, logoUrl, applyStyle, applyDefault, loadStyle, saveColours, uploadLogo, removeLogo, resetStyle }
})
