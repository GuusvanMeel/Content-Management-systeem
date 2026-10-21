// Runs the migrations on the test database once before all tests.
export async function setup() {
  const { db } = await import('../../src/db/knex.js')
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await db.raw('SELECT 1')
        break
      } catch (err) {
        if (attempt >= 30) throw err
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
    await db.migrate.latest()
  } finally {
    await db.destroy()
  }
}
