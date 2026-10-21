import { Router } from 'express'
import multer from 'multer'
import { AppError } from '../../lib/errors.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'
import * as service from './styleService.js'

export const LOGO_MAX_BYTES = 2 * 1024 * 1024

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LOGO_MAX_BYTES, files: 1 } })

export const styleRoutes = Router()

styleRoutes.get('/style', async (req, res) => {
  res.json(await service.getEffectiveStyle(getOrganisationId(req)))
})

styleRoutes.put('/style', async (req, res) => {
  const { primaryColour, secondaryColour } = req.body ?? {}
  const body = {}
  if (primaryColour !== undefined) body.primaryColour = primaryColour
  if (secondaryColour !== undefined) body.secondaryColour = secondaryColour
  res.json(await service.updateColours(getOrganisationId(req), body))
})

styleRoutes.put('/style/logo', upload.single('logo'), async (req, res) => {
  if (!req.file) throw new AppError(400, 'invalid_logo', 'Kies een afbeelding om te uploaden.')
  res.json(await service.replaceLogo(getOrganisationId(req), req.file.buffer))
})

styleRoutes.delete('/style/logo', async (req, res) => {
  res.json(await service.removeLogo(getOrganisationId(req)))
})

styleRoutes.delete('/style', async (req, res) => {
  res.json(await service.resetStyle(getOrganisationId(req)))
})
