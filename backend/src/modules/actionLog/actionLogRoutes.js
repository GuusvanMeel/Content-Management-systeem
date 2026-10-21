import { Router } from 'express'
import { getActionLogPage } from './actionLogService.js'

// Read-only: there are no routes to change or delete log entries (FR-028).
export const actionLogRoutes = Router()

actionLogRoutes.get('/', async (req, res) => {
  res.json(await getActionLogPage(req.query.page))
})
