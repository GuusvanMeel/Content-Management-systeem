// How many organisations lose access when the availability of a video changes (specs/003
// research R6, FR-017a). `allOrganisationIds` are the other active organisations.

/** The organisations (besides the owner) that can see a video with this availability. */
export function audience(value, allOrganisationIds) {
  if (value.visibility === 'public') return new Set(allOrganisationIds)
  if (value.visibility === 'selective') return new Set(value.accessOrganisationIds ?? [])
  return new Set()
}

export function countLosingAccess(current, next, allOrganisationIds) {
  const after = audience(next, allOrganisationIds)
  let lost = 0
  for (const id of audience(current, allOrganisationIds)) if (!after.has(id)) lost++
  return lost
}

/** The confirmation text before restricting (customer-facing, so Dutch). */
export function confirmationText(count) {
  return count === 1
    ? '1 organisatie kan deze video daarna niet meer zien.'
    : `${count} organisaties kunnen deze video daarna niet meer zien.`
}
