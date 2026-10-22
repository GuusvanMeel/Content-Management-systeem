import { createApp } from './app.js'
import { config } from './config/env.js'
import { startSessionCleanup } from './jobs/sessionCleanup.js'
import { startUploadCleanup } from './jobs/uploadCleanup.js'

const server = createApp().listen(config.API_PORT, () => {
  console.log(`API listening on port ${config.API_PORT}`)
})

// A 32 MB video chunk on a slow connection takes about 4.5 minutes, and the last chunk also
// waits for verification (specs/002 research R7). The default of 5 minutes is too tight.
server.requestTimeout = 15 * 60 * 1000

startSessionCleanup()
startUploadCleanup()
