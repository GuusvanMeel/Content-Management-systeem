// Formatting for the video library (specs/002 contracts/ui.md). 1 GB = 1024^3 bytes, the same
// definition the server uses for its limits.

const MIB = 1024 ** 2
const GIB = 1024 ** 3

const oneDecimal = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 3221225472 → "3,0 GB"; below 1 GB in MB. */
export function formatSize(bytes = 0) {
  const value = Number(bytes)
  if (value >= GIB) return `${oneDecimal.format(value / GIB)} GB`
  return `${oneDecimal.format(value / MIB)} MB`
}

/** 95 → "00:01:35". */
export function formatDurationHms(seconds = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/** ISO timestamp → "dd-mm-jjjj" in local time. */
export function formatDate(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`
}

/** Whole GB for messages, e.g. 10737418240 → "10". */
export function formatGb(bytes = 0) {
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(Number(bytes) / GIB)
}
