import { fileURLToPath } from 'node:url'
import { config } from './src/config/env.js'

export default {
  client: 'mysql2',
  connection: {
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.NODE_ENV === 'test' ? config.TEST_DB_NAME : config.DB_NAME,
    charset: 'utf8mb4',
    // All DATETIME columns hold UTC.
    timezone: 'Z',
  },
  pool: { min: 0, max: 10 },
  migrations: {
    directory: fileURLToPath(new URL('./src/db/migrations', import.meta.url)),
    loadExtensions: ['.js'],
  },
}
