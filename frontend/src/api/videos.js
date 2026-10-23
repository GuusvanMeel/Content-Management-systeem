import { api } from './client'

// Video library API (specs/002 and specs/003 contracts/api.md). Uploads go through tus, see stores/uploads.js.

export async function listVideos() {
  const data = await api('/api/organisation/videos')
  return data.videos
}

export function getVideo(id) {
  return api(`/api/organisation/videos/${id}`)
}

/** Changes name, description and/or availability of an own video. */
export function updateVideo(id, changes) {
  return api(`/api/organisation/videos/${id}`, { method: 'PATCH', body: changes })
}

export function deleteVideo(id) {
  return api(`/api/organisation/videos/${id}`, { method: 'DELETE' })
}

export function getUploadSettings() {
  return api('/api/organisation/videos/upload-settings')
}

/** The other active organisations ({ id, name }), for "Selectief beschikbaar". */
export async function listOtherOrganisations() {
  const data = await api('/api/organisation/organisations')
  return data.organisations
}
