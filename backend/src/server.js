import { createApp } from './app.js'
import { config } from './config/env.js'
import { startSessionCleanup } from './jobs/sessionCleanup.js'

createApp().listen(config.API_PORT, () => {
  console.log(`API listening on port ${config.API_PORT}`)
})

startSessionCleanup()
