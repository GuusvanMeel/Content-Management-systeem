import { Router } from 'express'
import { notFound } from '../../lib/errors.js'
import { listActive } from './organisationRepository.js'
import * as service from './organisationService.js'

export const adminOrganisationRoutes = Router()

function parseId(raw) {
  if (!/^\d+$/.test(raw)) throw notFound()
  return Number(raw)
}

adminOrganisationRoutes.get('/', async (_req, res) => {
  res.json({ organisations: await listActive() })
})

adminOrganisationRoutes.get('/code-suggestion', async (req, res) => {
  res.json({ loginCode: await service.suggestCode(req.query.name) })
})

adminOrganisationRoutes.get('/:id', async (req, res) => {
  res.json(await service.getOrganisation(parseId(req.params.id)))
})

adminOrganisationRoutes.post('/', async (req, res) => {
  const { name, loginCode, password } = req.body ?? {}
  const organisation = await service.createOrganisation(
    { name, loginCode, password },
    req.auth.administratorId,
  )
  res.status(201).json(organisation)
})

adminOrganisationRoutes.patch('/:id', async (req, res) => {
  const { name, loginCode } = req.body ?? {}
  res.json(
    await service.updateOrganisation(parseId(req.params.id), { name, loginCode }, req.auth.administratorId),
  )
})

adminOrganisationRoutes.put('/:id/password', async (req, res) => {
  await service.resetPassword(parseId(req.params.id), req.body?.password, req.auth.administratorId)
  res.status(204).end()
})

adminOrganisationRoutes.delete('/:id', async (req, res) => {
  await service.deleteOrganisation(parseId(req.params.id), req.auth.administratorId)
  res.status(204).end()
})
