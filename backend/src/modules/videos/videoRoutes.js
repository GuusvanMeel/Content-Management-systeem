import { Router } from 'express'
import { config } from '../../config/env.js'
import { AppError } from '../../lib/errors.js'
import { sendStoredFile } from '../../lib/sendStoredFile.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'
import { UPLOADS_PATH } from './tusServer.js'
import * as service from './videoService.js'

// Video library routes (specs/002 and specs/003 contracts/api.md). Mounted under
// /api/organisation, after requireOrganisation; the organisation id always comes from
// getOrganisationId(req). Which videos an organisation may see is decided in one place:
// videoRepository.visibleVideosQuery (specs/003 research R1).
export const videoRoutes = Router()

// Limits for the browser; changing them is a .env change plus an API restart (specs/002 research R10).
videoRoutes.get('/videos/upload-settings', (_req, res) => {
  res.json({
    maxFileSizeBytes: config.VIDEO_MAX_SIZE_BYTES,
    maxWidth: config.VIDEO_MAX_WIDTH,
    maxHeight: config.VIDEO_MAX_HEIGHT,
    maxParallelUploads: config.VIDEO_MAX_PARALLEL_UPLOADS,
    chunkSizeBytes: config.VIDEO_CHUNK_SIZE_BYTES,
    acceptedExtensions: ['.mp4'],
    uploadEndpoint: UPLOADS_PATH,
    defaultVisibility: config.VIDEO_DEFAULT_VISIBILITY,
    descriptionMaxLength: config.VIDEO_DESCRIPTION_MAX_LENGTH,
  })
})

videoRoutes.get('/videos', async (req, res) => {
  res.json({ videos: await service.listVideos(getOrganisationId(req)) })
})

/** A positive integer id from the URL; anything else is "not found". */
function videoId(req) {
  const raw = req.params.id
  if (!/^[1-9]\d{0,9}$/.test(raw)) throw new AppError(404, 'not_found', 'Niet gevonden.')
  return Number(raw)
}

videoRoutes.get('/videos/:id', async (req, res) => {
  res.json(await service.getVideoDetails(videoId(req), getOrganisationId(req)))
})

// Only the editable fields are read; the owner and the video's organisation never come from input.
videoRoutes.patch('/videos/:id', async (req, res) => {
  const { name, description, visibility, accessOrganisationIds } = req.body ?? {}
  res.json(
    await service.updateVideo(videoId(req), getOrganisationId(req), { name, description, visibility, accessOrganisationIds }),
  )
})

// Access check only; nginx delivers the bytes via X-Accel-Redirect (specs/002 research R8).
videoRoutes.get('/videos/:id/thumbnail', async (req, res) => {
  const key = await service.getThumbnailKey(videoId(req), getOrganisationId(req))
  await sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=3600' })
})

// Soft delete by the owner: the video leaves every library, file and thumbnail stay on disk.
videoRoutes.delete('/videos/:id', async (req, res) => {
  await service.deleteVideo(videoId(req), getOrganisationId(req))
  res.status(204).end()
})
