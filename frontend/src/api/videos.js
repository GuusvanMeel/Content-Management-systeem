import { api } from './client'

// Video library API (specs/002 contracts/api.md). Uploads go through tus, see stores/uploads.js.

export async function listVideos() {
  const data = await api('/api/organisation/videos')
  return data.videos
}

export function deleteVideo(id) {
  return api(`/api/organisation/videos/${id}`, { method: 'DELETE' })
}

export function getUploadSettings() {
  return api('/api/organisation/videos/upload-settings')
}
