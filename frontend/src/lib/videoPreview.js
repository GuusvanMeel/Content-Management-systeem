// Best-effort preview frame for the upload dialog (contracts/ui.md). Only for the teacher's eye;
// it plays no part in the check. Returns a data URL, or null when the browser cannot decode it.

const PREVIEW_TIMEOUT_MS = 5000

export function createPreview(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), PREVIEW_TIMEOUT_MS)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2)
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 160
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        finish(null)
      }
    }
    video.onerror = () => finish(null)
    video.src = url
  })
}
