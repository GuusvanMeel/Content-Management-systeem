import { Router } from 'express'
import { notFound } from '../../lib/errors.js'
import { sendStoredFile } from '../../lib/sendStoredFile.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'
import * as service from './courseService.js'

// Course routes (specs/004 contracts/api.md). Mounted under /api/organisation, after
// requireOrganisation; the organisation id always comes from getOrganisationId(req). Which
// courses an organisation may see is decided in one place: courseRepository.ownCoursesQuery.
export const courseRoutes = Router()

/** A positive integer id from the URL; anything else is "not found". */
function idParam(raw) {
  if (!/^[1-9]\d{0,9}$/.test(raw)) throw notFound()
  return Number(raw)
}
const courseId = (req) => idParam(req.params.id)

courseRoutes.get('/courses', async (req, res) => {
  res.json({ courses: await service.listCourses(getOrganisationId(req)) })
})

// Only name and description are read; the organisation always comes from the session.
courseRoutes.post('/courses', async (req, res) => {
  const { name, description } = req.body ?? {}
  res.status(201).json(await service.createCourse(getOrganisationId(req), { name, description }))
})

courseRoutes.get('/courses/:id', async (req, res) => {
  res.json(await service.getDraft(courseId(req), getOrganisationId(req)))
})

// Thumbnail of the video in a video step of an own course, also when that video is no longer in
// the library (FR-016a, research R5a). Access check only; nginx delivers the bytes via
// X-Accel-Redirect. The library's thumbnail route and its rule stay as they are. The video id is
// part of the URL, so replacing the video gives a new URL and the browser cache never shows the
// old thumbnail.
courseRoutes.get('/courses/:id/steps/:stepId/videos/:videoId/thumbnail', async (req, res) => {
  const key = await service.getStepVideoThumbnailKey(
    courseId(req),
    idParam(req.params.stepId),
    idParam(req.params.videoId),
    getOrganisationId(req),
  )
  await sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=3600' })
})

// "Opslaan als concept": the whole draft at once (research R3). Only these fields are read.
courseRoutes.put('/courses/:id', async (req, res) => {
  const { name, description, steps } = req.body ?? {}
  res.json(await service.saveDraft(courseId(req), getOrganisationId(req), { name, description, steps }))
})
