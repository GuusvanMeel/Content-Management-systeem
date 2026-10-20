import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { seed, DEFAULT_BRANDING } from '../data/seed'
import { uid } from '../lib/util'
import { contentSnapshot, usedVideoIds, newVideoNode } from '../lib/course'
import { validateCourse } from '../lib/validate'

// Everything is saved in the browser (localStorage); there is no backend.
const KEY = 'vr-cursus-studio:v3'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useApp = defineStore('app', () => {
  const init = load() ?? seed()
  const orgs = ref(init.orgs)
  const videos = ref(init.videos)
  const courses = ref(init.courses)
  const currentOrgId = ref(init.currentOrgId)
  const editorVariant = ref(init.editorVariant ?? 'inspector')

  const org = computed(() => orgs.value.find((o) => o.id === currentOrgId.value) ?? orgs.value[0])
  const branding = computed(() => org.value?.branding ?? DEFAULT_BRANDING)
  const orgCourses = computed(() => courses.value.filter((c) => c.orgId === currentOrgId.value))
  const orgVideos = computed(() => videos.value.filter((v) => v.orgId === currentOrgId.value))
  const videosById = computed(() => Object.fromEntries(videos.value.map((v) => [v.id, v])))

  let timer
  watch(
    [orgs, videos, courses, currentOrgId, editorVariant],
    () => {
      clearTimeout(timer)
      timer = setTimeout(save, 600)
    },
    { deep: true },
  )
  function save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ orgs: orgs.value, videos: videos.value, courses: courses.value, currentOrgId: currentOrgId.value, editorVariant: editorVariant.value }),
      )
    } catch {
      /* storage not available: keep working in memory */
    }
  }
  function resetDemo() {
    const s = seed()
    orgs.value = s.orgs
    videos.value = s.videos
    courses.value = s.courses
    currentOrgId.value = s.currentOrgId
  }

  // courses
  const getCourse = (id) => courses.value.find((c) => c.id === id)
  function createCourse({ name, description }) {
    const first = newVideoNode({ x: 0, y: 0 })
    const c = {
      id: uid('c'),
      orgId: currentOrgId.value,
      name,
      description,
      startId: first.id,
      nodes: [first],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      published: false,
      publishedVersion: 0,
      publishedSnapshot: null,
    }
    courses.value.unshift(c)
    return c
  }
  function deleteCourse(id) {
    courses.value = courses.value.filter((c) => c.id !== id)
  }
  const validation = (course) => validateCourse(course, videosById.value)
  function publish(course) {
    if (!validation(course).canPublish) return false
    course.published = true
    course.publishedVersion = (course.publishedVersion ?? 0) + 1
    course.publishedSnapshot = contentSnapshot(course)
    course.publishedAt = Date.now()
    return true
  }
  function unpublish(course) {
    course.published = false
  }

  // videos
  const videoUsage = (videoId) => orgCourses.value.filter((c) => usedVideoIds(c).has(videoId))
  function addVideo(v) {
    const video = { id: uid('vid'), orgId: currentOrgId.value, uploadedAt: Date.now(), ...v }
    videos.value.unshift(video)
    return video
  }
  function deleteVideo(id) {
    if (videoUsage(id).length) return false
    videos.value = videos.value.filter((v) => v.id !== id)
    return true
  }

  // organisation
  function updateBranding(patch) {
    org.value.branding = { ...(org.value.branding ?? DEFAULT_BRANDING), ...patch }
  }
  function resetBranding() {
    org.value.branding = null
  }

  return {
    orgs, videos, courses, currentOrgId, editorVariant,
    org, branding, orgCourses, orgVideos, videosById,
    resetDemo, getCourse, createCourse, deleteCourse, validation, publish, unpublish,
    videoUsage, addVideo, deleteVideo, updateBranding, resetBranding,
  }
})
