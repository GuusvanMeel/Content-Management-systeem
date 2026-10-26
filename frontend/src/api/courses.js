import { api } from './client'

// Course API (specs/004 contracts/api.md). Everything is a draft in this feature.

export async function listCourses() {
  const data = await api('/api/organisation/courses')
  return data.courses
}

export function createCourse({ name, description }) {
  return api('/api/organisation/courses', { method: 'POST', body: { name, description } })
}

export function getCourse(id) {
  return api(`/api/organisation/courses/${id}`)
}

/** "Opslaan als concept": sends the whole draft and returns the saved draft with all ids. */
export function saveCourse(id, draft) {
  return api(`/api/organisation/courses/${id}`, { method: 'PUT', body: draft })
}

export function deleteCourse(id) {
  return api(`/api/organisation/courses/${id}`, { method: 'DELETE' })
}
