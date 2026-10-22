import { Router } from 'express'
import { tusServer } from './tusServer.js'
import { videoUploadGuard } from './videoUploadGuard.js'

// tus endpoint (contracts/api.md). Mounted under /api/organisation, after requireOrganisation.
export const videoUploadRoutes = Router()

async function handleWithTus(req, res) {
  // tus matches on the full path; Express has stripped the mount path from req.url.
  req.url = req.originalUrl
  await tusServer.handle(req, res)
}

videoUploadRoutes.all('/video-uploads', videoUploadGuard, handleWithTus)
videoUploadRoutes.all('/video-uploads/:uploadId', videoUploadGuard, handleWithTus)
