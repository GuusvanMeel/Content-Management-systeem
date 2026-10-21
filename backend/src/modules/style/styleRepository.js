import { db } from '../../db/knex.js'

// Every function takes the organisation id explicitly; it always comes from the session (research R8).
function requireId(organisationId) {
  if (!organisationId) throw new Error('organisationId is required')
}

export function findByOrganisationId(organisationId) {
  requireId(organisationId)
  return db('OrganisationStyle').where({ organisationId }).first()
}

export function upsertStyle(organisationId, fields) {
  requireId(organisationId)
  return db('OrganisationStyle')
    .insert({ organisationId, ...fields })
    .onConflict('organisationId')
    .merge(fields)
}

export function deleteByOrganisationId(organisationId) {
  requireId(organisationId)
  return db('OrganisationStyle').where({ organisationId }).del()
}
