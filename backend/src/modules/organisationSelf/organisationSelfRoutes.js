import { Router } from 'express'
import { notFound } from '../../lib/errors.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'
import { findActiveById } from '../organisations/organisationRepository.js'

export const organisationSelfRoutes = Router()

organisationSelfRoutes.get('/', async (req, res) => {
  const organisation = await findActiveById(getOrganisationId(req))
  if (!organisation) throw notFound()
  res.json({ id: organisation.id, name: organisation.name, loginCode: organisation.loginCode })
})
