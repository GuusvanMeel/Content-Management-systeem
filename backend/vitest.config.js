import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Set before globalSetup and the test workers start, so both see the same environment.
process.env.NODE_ENV = 'test'
process.env.COOKIE_SECURE = 'false'
process.env.UPLOADS_DIR = path.join(os.tmpdir(), 'cms-test-uploads')
process.env.VIDEOS_DIR = path.join(os.tmpdir(), 'cms-test-videos')
// Outside Docker the tests use the db-test container that is published on localhost:3307.
if (!process.env.DB_HOST) {
  process.env.DB_HOST = 'localhost'
  process.env.DB_PORT = '3307'
}

export default defineConfig({
  test: {
    globalSetup: ['tests/helpers/globalSetup.js'],
    setupFiles: ['tests/helpers/setup.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
