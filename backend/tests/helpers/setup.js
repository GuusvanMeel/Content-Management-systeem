import { afterAll } from 'vitest'
import { db } from '../../src/db/knex.js'

afterAll(async () => {
  await db.destroy()
})
