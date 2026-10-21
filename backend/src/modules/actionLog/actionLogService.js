import { listEntries } from './actionLogRepository.js'

export const ACTION_LOG_PAGE_SIZE = 50

const toIsoSeconds = (date) => new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z')
const parseDetails = (value) =>
  value === null || value === undefined ? null : typeof value === 'string' ? JSON.parse(value) : value

/** Newest first, 50 per page (FR-028, research R11). */
export async function getActionLogPage(rawPage) {
  const parsed = Number.parseInt(rawPage, 10)
  const page = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
  const { total, rows } = await listEntries({
    limit: ACTION_LOG_PAGE_SIZE,
    offset: (page - 1) * ACTION_LOG_PAGE_SIZE,
  })
  return {
    entries: rows.map((row) => ({
      id: row.id,
      createdAt: toIsoSeconds(row.createdAt),
      action: row.action,
      administrator: row.administrator,
      organisation: {
        id: row.organisationId,
        name: row.organisationName,
        deleted: row.organisationDeletedAt !== null,
      },
      details: parseDetails(row.details),
    })),
    page,
    pageSize: ACTION_LOG_PAGE_SIZE,
    total,
  }
}
