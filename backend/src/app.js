import cookieParser from 'cookie-parser'
import express from 'express'
import { config } from './config/env.js'
import { csrf } from './middleware/csrf.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { requireAdmin } from './middleware/requireAdmin.js'
import { requireOrganisation } from './middleware/requireOrganisation.js'
import { session } from './middleware/session.js'
import { actionLogRoutes } from './modules/actionLog/actionLogRoutes.js'
import { authRoutes } from './modules/auth/authRoutes.js'
import { organisationSelfRoutes } from './modules/organisationSelf/organisationSelfRoutes.js'
import { adminOrganisationRoutes } from './modules/organisations/adminOrganisationRoutes.js'
import { styleRoutes } from './modules/style/styleRoutes.js'
import { videoRoutes } from './modules/videos/videoRoutes.js'
import { videoUploadRoutes } from './modules/videos/videoUploadRoutes.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')

  // Development only: in production nginx serves /media from the uploads volume (constitution III).
  if (config.NODE_ENV !== 'production') {
    app.use(
      '/media',
      express.static(config.UPLOADS_DIR, {
        setHeaders: (res) => {
          res.set('X-Content-Type-Options', 'nosniff')
          res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        },
      }),
    )
  }

  // Outside the session middleware, so a health check never extends a session.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

  app.use('/api', express.json({ limit: '100kb' }), cookieParser(), csrf, session)

  app.use('/api/auth', authRoutes)

  app.use('/api/admin', requireAdmin)
  app.use('/api/admin/organisations', adminOrganisationRoutes)
  app.use('/api/admin/action-log', actionLogRoutes)

  // Every route under /api/organisation MUST take the organisation id from
  // getOrganisationId(req), never from params, query or body (FR-022, research R8).
  // express.json only reads application/json, so tus chunks (application/offset+octet-stream)
  // reach the tus server untouched.
  app.use('/api/organisation', requireOrganisation, organisationSelfRoutes, styleRoutes, videoRoutes, videoUploadRoutes)

  app.use('/api', notFoundHandler)
  app.use(errorHandler)
  return app
}
