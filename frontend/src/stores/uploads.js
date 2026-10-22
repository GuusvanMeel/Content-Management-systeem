import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import * as tus from 'tus-js-client'
import { ApiError, notifyUnauthorized } from '../api/client'
import { getUploadSettings } from '../api/videos'
import { formatGb } from '../lib/format'

// All video uploads of this browser tab (specs/002 research R10, contracts/ui.md). The store
// lives as long as the app, so uploads keep going while the teacher moves around the CMS
// (FR-006a). At most `maxParallelUploads` run at the same time; the rest wait (FR-006b).

// Customer-facing texts (contracts/ui.md), therefore in Dutch.
export const TEXT = {
  unsupported: "Alleen MP4-video's (H.264) worden ondersteund.",
  tooLarge: (bytes) => `Een video mag maximaal ${formatGb(bytes)} GB zijn.`,
  expired: 'Upload onderbroken. Log opnieuw in en kies hetzelfde bestand om verder te gaan.',
  failed: 'Uploaden is mislukt. Kies hetzelfde bestand opnieuw om verder te gaan.',
}

// Statuses for which retrying makes no sense: the answer will not change.
const NO_RETRY = new Set([401, 403, 404, 413, 415, 422, 507])
const RETRY_DELAYS = [0, 3000, 10000, 30000, 60000]

const ACTIVE = new Set(['queued', 'uploading', 'retrying', 'verifying'])

let nextId = 1

/** Status, code and message of a tus error, in the API error format where possible. */
export function describeTusError(error) {
  const response = error?.originalResponse
  const status = response?.getStatus?.() ?? 0
  let body
  try {
    body = JSON.parse(response?.getBody?.() ?? '')
  } catch {
    body = null
  }
  return { status, code: body?.error?.code, message: body?.error?.message }
}

export const useUploads = defineStore('uploads', () => {
  const items = ref([])
  const settings = ref(null)
  // Increases whenever a video was added; the library reloads on change.
  const addedCount = ref(0)
  // Not reactive: File objects and tus uploads stay out of Vue's proxies.
  const files = new Map()
  const tusUploads = new Map()

  const running = computed(() => items.value.filter((i) => ['uploading', 'retrying', 'verifying'].includes(i.state)))
  const waiting = computed(() => items.value.filter((i) => i.state === 'queued'))
  const hasActive = computed(() => items.value.some((i) => ACTIVE.has(i.state)))

  async function ensureSettings() {
    if (!settings.value) settings.value = await getUploadSettings()
    return settings.value
  }

  const find = (id) => items.value.find((i) => i.id === id)
  const update = (id, changes) => Object.assign(find(id) ?? {}, changes)

  function forget(id) {
    files.delete(id)
    tusUploads.delete(id)
  }

  /**
   * Adds files: checks extension and size first (nothing is sent for a refused file), then
   * queues the rest. `name` is only used when one file is added.
   */
  async function addFiles(fileList, { name } = {}) {
    const limits = await ensureSettings()
    const list = [...fileList]
    for (const file of list) {
      const item = {
        id: nextId++,
        name: (list.length === 1 && name?.trim()) || file.name.replace(/\.mp4$/i, ''),
        fileName: file.name,
        bytesUploaded: 0,
        bytesTotal: file.size,
        state: 'queued',
        message: '',
        resumed: false,
      }
      if (!/\.mp4$/i.test(file.name)) {
        Object.assign(item, { state: 'rejected', message: TEXT.unsupported })
      } else if (file.size > limits.maxFileSizeBytes) {
        Object.assign(item, { state: 'rejected', message: TEXT.tooLarge(limits.maxFileSizeBytes) })
      } else {
        files.set(item.id, file)
      }
      items.value.push(item)
    }
    pump()
  }

  /** Starts queued uploads while there is room. */
  function pump() {
    const limit = settings.value?.maxParallelUploads ?? 1
    while (running.value.length < limit && waiting.value.length > 0) {
      start(waiting.value[0])
    }
  }

  function finish(id, changes) {
    update(id, changes)
    forget(id)
    pump()
  }

  function start(item) {
    const id = item.id
    const file = files.get(id)
    item.state = 'uploading'
    const limits = settings.value

    const upload = new tus.Upload(file, {
      endpoint: limits.uploadEndpoint,
      chunkSize: limits.chunkSizeBytes,
      retryDelays: RETRY_DELAYS,
      headers: { 'X-Requested-With': 'cms' },
      metadata: { filename: file.name, name: item.name },
      removeFingerprintOnSuccess: true,
      onProgress(bytesSent, bytesTotal) {
        update(id, {
          bytesUploaded: bytesSent,
          bytesTotal,
          // All bytes sent: the server now checks the file before it answers (FR-013).
          state: bytesSent >= bytesTotal ? 'verifying' : 'uploading',
        })
      },
      onShouldRetry(error) {
        const { status } = describeTusError(error)
        if (NO_RETRY.has(status)) return false
        update(id, { state: 'retrying' })
        return true
      },
      onSuccess({ lastResponse }) {
        let video
        try {
          video = JSON.parse(lastResponse.getBody()).video
        } catch {
          video = null
        }
        addedCount.value++
        finish(id, { state: 'done', video, bytesUploaded: item.bytesTotal })
      },
      onError(error) {
        const { status, code, message } = describeTusError(error)
        if (status === 401) {
          finish(id, { state: 'expired', message: TEXT.expired })
          notifyUnauthorized(new ApiError(401, code ?? 'not_authenticated', message ?? TEXT.expired))
          return
        }
        finish(id, { state: 'rejected', message: message ?? TEXT.failed })
      },
    })
    tusUploads.set(id, upload)

    // A file this browser started before continues where it stopped (FR-007, FR-009).
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) {
          upload.resumeFromPreviousUpload(previous[0])
          update(id, { resumed: true })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (find(id)?.state === 'uploading') upload.start()
      })
  }

  /** Waiting: taken out of the queue. Running: stopped and the received chunks removed (FR-010). */
  async function cancel(id) {
    const upload = tusUploads.get(id)
    items.value = items.value.filter((i) => i.id !== id)
    forget(id)
    if (upload) await upload.abort(true).catch(() => {})
    pump()
  }

  /** Removes a finished line from the indicator. */
  function dismiss(id) {
    items.value = items.value.filter((i) => i.id !== id || ACTIVE.has(i.state))
  }

  /** On logout: stops everything without removing the chunks, so the uploads can be resumed. */
  async function abortAll() {
    const pending = [...tusUploads.values()].map((upload) => upload.abort(false).catch(() => {}))
    items.value = []
    files.clear()
    tusUploads.clear()
    await Promise.all(pending)
  }

  // Warn before closing or reloading the tab while something runs or waits (FR-006c).
  const onBeforeUnload = (event) => {
    event.preventDefault()
    event.returnValue = ''
  }
  watch(hasActive, (active) => {
    if (active) window.addEventListener('beforeunload', onBeforeUnload)
    else window.removeEventListener('beforeunload', onBeforeUnload)
  })

  return { items, settings, addedCount, running, waiting, hasActive, ensureSettings, addFiles, cancel, dismiss, abortAll }
})
