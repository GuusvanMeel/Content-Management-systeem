// Search, filter and sort of the video library, in the browser on the full list (specs/003
// research R7, FR-023 – FR-025a). Pure functions, so they are easy to test.

export const OWNERSHIP_OPTIONS = [
  { key: 'all', label: "Alle video's" },
  { key: 'own', label: "Eigen video's" },
  { key: 'others', label: 'Van andere organisaties' },
]

export const SORT_OPTIONS = [
  { key: 'newest', label: 'Nieuwste eerst', field: 'uploadedAt', direction: 'desc' },
  { key: 'oldest', label: 'Oudste eerst', field: 'uploadedAt', direction: 'asc' },
  { key: 'name-asc', label: 'Naam (A–Z)', field: 'name', direction: 'asc' },
  { key: 'name-desc', label: 'Naam (Z–A)', field: 'name', direction: 'desc' },
  { key: 'longest', label: 'Langste eerst', field: 'durationSeconds', direction: 'desc' },
  { key: 'shortest', label: 'Kortste eerst', field: 'durationSeconds', direction: 'asc' },
  { key: 'largest', label: 'Grootste eerst', field: 'fileSizeBytes', direction: 'desc' },
  { key: 'smallest', label: 'Kleinste eerst', field: 'fileSizeBytes', direction: 'asc' },
]

export const DEFAULT_SORT = 'newest'

/** Lower case without accents, so "cafe" finds "Café" and "ZWEMBAD a" finds "Zwembad A". */
export function normalizeForSearch(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Videos whose name, description or owner contains the query, and that match the ownership
 * filter and, when given, the owning organisation (FR-025b).
 */
export function filterVideos(videos, { query = '', ownership = 'all', ownerId = null } = {}) {
  const needle = normalizeForSearch(query.trim())
  return videos.filter((video) => {
    if (ownership === 'own' && !video.owner.isOwn) return false
    if (ownership === 'others' && video.owner.isOwn) return false
    if (ownerId !== null && video.owner.id !== ownerId) return false
    if (!needle) return true
    return [video.name, video.description, video.owner.name].some((text) => normalizeForSearch(text).includes(needle))
  })
}

const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true })

const COMPARE = {
  name: (a, b) => collator.compare(a.name, b.name),
  uploadedAt: (a, b) => Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt),
  durationSeconds: (a, b) => (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0),
  fileSizeBytes: (a, b) => a.fileSizeBytes - b.fileSizeBytes,
}

/** A sorted copy; equal values are ordered by id, so the order is always the same. */
export function sortVideos(videos, { field = 'uploadedAt', direction = 'desc' } = {}) {
  const compare = COMPARE[field] ?? COMPARE.uploadedAt
  const sign = direction === 'asc' ? 1 : -1
  return [...videos].sort((a, b) => sign * (compare(a, b) || a.id - b.id))
}

/** The library as shown: filtered, then sorted with the chosen option. */
export function libraryView(videos, { query, ownership, ownerId = null, sort = DEFAULT_SORT }) {
  const option = SORT_OPTIONS.find((o) => o.key === sort) ?? SORT_OPTIONS[0]
  return sortVideos(filterVideos(videos, { query, ownership, ownerId }), option)
}
