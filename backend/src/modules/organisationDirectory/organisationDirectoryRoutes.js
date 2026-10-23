import { Router } from 'express'
import { db } from '../../db/knex.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'

// Names of the other active organisations, for choosing "Selectief beschikbaar" (specs/003
// FR-004, research R10). Only id and name: login codes and Quest link codes never leave the admin area.
export const organisationDirectoryRoutes = Router()

organisationDirectoryRoutes.get('/organisations', async (req, res) => {
  const organisations = await db('Organisation')
    .whereNull('deletedAt')
    .whereNot('id', getOrganisationId(req))
    .orderBy('name')
    .select('id', 'name')
  res.json({ organisations })
})
