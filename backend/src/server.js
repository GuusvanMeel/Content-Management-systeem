import http from 'node:http'
import { createApp } from './app.js'
import { config } from './config/env.js'
import { startSessionCleanup } from './jobs/sessionCleanup.js'
import { startUploadCleanup } from './jobs/uploadCleanup.js'

// A tus Upload-Metadata header with a description of 1000 characters and the chosen organisations
// can reach about 13 KB, while Node allows 16 KB for all headers together (specs/003 research R4).
const MAX_HEADER_SIZE = 32 * 1024

const server = http.createServer({ maxHeaderSize: MAX_HEADER_SIZE }, createApp())
server.listen(config.API_PORT, () => {
  console.log(`API listening on port ${config.API_PORT}`)
})

// A 32 MB video chunk on a slow connection takes about 4.5 minutes, and the last chunk also
// waits for verification (specs/002 research R7). The default of 5 minutes is too tight.
server.requestTimeout = 15 * 60 * 1000

startSessionCleanup()
startUploadCleanup()
