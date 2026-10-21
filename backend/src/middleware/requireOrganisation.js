import { requireRole } from './requireAdmin.js'

export const requireOrganisation = requireRole('organisation')

/**
 * The organisation id comes from the session only, never from params, query or body, so it
 * cannot be manipulated (FR-022, research R8).
 */
export function getOrganisationId(req) {
  const id = req.auth?.role === 'organisation' ? req.auth.organisationId : undefined
  if (!id) throw new Error('getOrganisationId called without an organisation session')
  return id
}
