import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import * as tus from 'tus-js-client'
import { ApiError, notifyUnauthorized } from '../api/client'
import { getUploadSettings } from '../api/videos'
import { videoMessage } from '../lib/videoMessages'

// All video uploads of this browser tab (specs/002 research R10, contracts/ui.md). The store
// lives as long as the app, so uploads keep going while the teacher moves around the CMS
// (FR-006a). At most `maxParallelUploads` run at the same time; the rest wait (FR-006b).

// Customer-facing texts (contracts/ui.md), therefore in Dutch.
export const TEXT = {
  expired: 'Upload onderbroken. Log opnieuw in en kies hetzelfde bestand om verder te gaan.',
  failed: 'Uploaden is mislukt. Kies hetzelfde bestand opnieuw om verder te gaan.',
}

// Statuses for which retrying makes no sense: the answer will not change.
const NO_RETRY = new Set([400, 401, 403, 404, 413, 415, 422, 507])
const RETRY_DELAYS = [0, 3000, 10000, 30000, 60000]
// Rejections by the server that also get a centred message (FR-014).
const SERVER_REJECTION = new Set([400, 413, 415, 422, 507])

const ACTIVE = new Set(['queued', 'uploading', 'retrying', 'verifying'])
const REQUEST_HEADERS = { 'X-Requested-With': 'cms' }

let nextId = 1

/** tus metadata of an upload; empty choices are left out so the server's default applies. */
export function uploadMetadata(file, item) {
  const metadata = { filename: file.name, name: item.name }
  if (item.visibility) metadata.visibility = item.visibility
  if (item.description) metadata.description = item.description
  if (item.visibility === 'selective' && item.accessOrganisationIds.length > 0) {
    metadata.accessOrganisationIds = item.accessOrganisationIds.join(',')
  }
  return metadata
}

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
  // A refused choice (specs/003) names the field; its message says what to fix.
  const fieldMessage = Object.values(body?.error?.fields ?? {})[0]
  return { status, code: body?.error?.code, message: fieldMessage ?? body?.error?.message }
}

export const useUploads = defineStore('uploads', () => {
  const items = ref([])
  const settings = ref(null)
  // Increases whenever a video was added; the library reloads on change.
  const addedCount = ref(0)
  // Increases on events the teacher must notice: an upload finished, an error or rejection
  // (including an expired session) and a lost connection. Only these open the indicator by
  // itself (FR-006a).
  const noticeCount = ref(0)
  // Increases whenever an upload actually starts; the indicator plays its drop animation (FR-006d).
  const startedCount = ref(0)
  // The file picker of the videos page, so the indicator can open it when nothing is listed.
  let filePicker = null
  // Server rejections waiting for the centred message (FR-014).
  const rejections = ref([])
  // Interrupted uploads that this browser remembers (FR-009a).
  const interrupted = ref([])
  // Not reactive: File objects and tus uploads stay out of Vue's proxies.
  const files = new Map()
  const tusUploads = new Map()

  const running = computed(() => items.value.filter((i) => ['uploading', 'retrying', 'verifying'].includes(i.state)))
  const waiting = computed(() => items.value.filter((i) => i.state === 'queued'))
  const hasActive = computed(() => items.value.some((i) => ACTIVE.has(i.state)))
  const overallProgress = computed(() => {
    const active = items.value.filter((i) => ACTIVE.has(i.state))
    const total = active.reduce((sum, i) => sum + i.bytesTotal, 0)
    return total > 0 ? active.reduce((sum, i) => sum + i.bytesUploaded, 0) / total : 0
  })

  async function ensureSettings() {
    if (!settings.value) settings.value = await getUploadSettings()
    return settings.value
  }

  const find = (id) => items.value.find((i) => i.id === id)
  const update = (id, changes) => Object.assign(find(id) ?? {}, changes)
  const notice = () => noticeCount.value++

  function forget(id) {
    files.delete(id)
    tusUploads.delete(id)
  }

  /**
   * Queues files. Each entry is a File or `{ file, name }`; the upload dialog has checked them
   * already (FR-013). Extension and size are checked again here as a safety net.
   */
  async function addFiles(entries, { name } = {}) {
    const limits = await ensureSettings()
    const list = [...entries].map((entry) => (entry instanceof File ? { file: entry } : entry))
    for (const { file, name: entryName, description = '', visibility, accessOrganisationIds = [] } of list) {
      const chosenName = entryName ?? (list.length === 1 ? name : undefined)
      const item = {
        id: nextId++,
        name: chosenName?.trim() || file.name.replace(/\.mp4$/i, ''),
        fileName: file.name,
        // Availability and description go with the upload (specs/003 research R4).
        description: description.trim(),
        visibility,
        accessOrganisationIds: visibility === 'selective' ? accessOrganisationIds : [],
        bytesUploaded: 0,
        bytesTotal: file.size,
        state: 'queued',
        message: '',
        resumed: false,
      }
      if (!/\.mp4$/i.test(file.name)) {
        Object.assign(item, { state: 'rejected', message: videoMessage('video_unsupported_format', limits) })
      } else if (file.size > limits.maxFileSizeBytes) {
        Object.assign(item, { state: 'rejected', message: videoMessage('video_too_large', limits) })
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
      headers: REQUEST_HEADERS,
      metadata: uploadMetadata(file, item),
      removeFingerprintOnSuccess: true,
      onProgress(bytesSent, bytesTotal) {
        // All bytes sent: the server now checks the file before it answers (FR-013a).
        const state = bytesSent >= bytesTotal ? 'verifying' : 'uploading'
        update(id, { bytesUploaded: bytesSent, bytesTotal, state })
      },
      onShouldRetry(error) {
        const { status } = describeTusError(error)
        if (NO_RETRY.has(status)) return false
        update(id, { state: 'retrying' })
        notice()
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
        notice()
      },
      onError(error) {
        const { status, code, message } = describeTusError(error)
        if (status === 401) {
          finish(id, { state: 'expired', message: TEXT.expired })
          notice()
          notifyUnauthorized(new ApiError(401, code ?? 'not_authenticated', message ?? TEXT.expired))
          return
        }
        const text = message ?? TEXT.failed
        if (SERVER_REJECTION.has(status)) rejections.value.push({ id, name: item.name, fileName: file.name, message: text })
        finish(id, { state: 'rejected', message: text })
        notice()
      },
    })
    tusUploads.set(id, upload)
    startedCount.value++

    // A file this browser started before continues where it stopped (FR-007, FR-009).
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) {
          upload.resumeFromPreviousUpload(previous[0])
          update(id, { resumed: true })
          interrupted.value = interrupted.value.filter((entry) => entry.urlStorageKey !== previous[0].urlStorageKey)
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

  /** The videos page registers its file picker; returns a function that unregisters it. */
  function registerFilePicker(open) {
    filePicker = open
    return () => {
      if (filePicker === open) filePicker = null
    }
  }

  /** Opens the file picker of the videos page, if that page is shown (FR-006a). */
  function openFilePicker() {
    filePicker?.()
  }

  /** Removes a finished line from the indicator. */
  function dismiss(id) {
    items.value = items.value.filter((i) => i.id !== id || ACTIVE.has(i.state))
  }

  function dismissRejection() {
    rejections.value.shift()
  }

  /** On logout: stops everything without removing the chunks, so the uploads can be resumed. */
  async function abortAll() {
    const pending = [...tusUploads.values()].map((upload) => upload.abort(false).catch(() => {}))
    items.value = []
    files.clear()
    tusUploads.clear()
    await Promise.all(pending)
  }

  /**
   * Interrupted uploads of this browser, from tus-js-client's own storage plus one HEAD each for
   * the percentage (research R14). Uploads running in this tab are skipped; uploads the server no
   * longer has are forgotten silently.
   */
  async function loadInterrupted() {
    const storage = tus.defaultOptions.urlStorage
    let stored
    try {
      stored = await storage.findAllUploads()
    } catch {
      stored = []
    }
    const runningUrls = new Set([...tusUploads.values()].map((upload) => upload.url).filter(Boolean))
    const found = []
    for (const entry of stored) {
      if (!entry.uploadUrl || runningUrls.has(entry.uploadUrl)) continue
      let response
      try {
        response = await fetch(entry.uploadUrl, {
          method: 'HEAD',
          headers: { 'Tus-Resumable': '1.0.0' },
          credentials: 'same-origin',
        })
      } catch {
        continue
      }
      if (response.status === 404) {
        await storage.removeUpload(entry.urlStorageKey).catch(() => {})
        continue
      }
      if (!response.ok) continue
      const offset = Number(response.headers.get('Upload-Offset'))
      const size = Number(response.headers.get('Upload-Length')) || entry.size || 0
      found.push({
        urlStorageKey: entry.urlStorageKey,
        uploadUrl: entry.uploadUrl,
        name: entry.metadata?.name || (entry.metadata?.filename ?? '').replace(/\.mp4$/i, '') || 'Video',
        percent: size > 0 ? Math.floor((offset / size) * 100) : 0,
      })
    }
    interrupted.value = found
    return found
  }

  /** "Verwijderen": cancels the upload on the server and forgets it in this browser (FR-009a). */
  async function discardInterrupted(entry) {
    interrupted.value = interrupted.value.filter((e) => e.urlStorageKey !== entry.urlStorageKey)
    await tus.Upload.terminate(entry.uploadUrl, { headers: REQUEST_HEADERS }).catch(() => {})
    await tus.defaultOptions.urlStorage.removeUpload(entry.urlStorageKey).catch(() => {})
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

  return {
    items,
    settings,
    addedCount,
    noticeCount,
    startedCount,
    rejections,
    interrupted,
    running,
    waiting,
    hasActive,
    overallProgress,
    ensureSettings,
    addFiles,
    cancel,
    dismiss,
    dismissRejection,
    abortAll,
    loadInterrupted,
    discardInterrupted,
    registerFilePicker,
    openFilePicker,
  }
})
