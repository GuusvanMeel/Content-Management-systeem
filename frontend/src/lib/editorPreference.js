// The chosen editor view, remembered per browser. Only a preference: without storage the editor
// simply starts in the default view (specs/004 research R9).
const KEY = 'cms:editor-variant'
const VARIANTS = ['popover', 'inspector', 'list']
const DEFAULT = 'inspector'

export function getEditorVariant() {
  try {
    const value = localStorage.getItem(KEY)
    return VARIANTS.includes(value) ? value : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function setEditorVariant(value) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    /* storage not available: the choice lasts until the page is closed */
  }
}
