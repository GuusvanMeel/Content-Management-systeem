import { config } from '../config/env.js'
import { deleteExpired } from '../modules/auth/sessionRepository.js'

const INTERVAL_MS = 15 * 60 * 1000

/** Removes expired sessions. Expired sessions are rejected anyway; this is maintenance (research R3a). */
export async function runSessionCleanup() {
  const removed = await deleteExpired(config.SESSION_IDLE_TIMEOUT_MINUTES)
  console.log(`session cleanup: removed ${removed} expired sessions`)
  return removed
}

/** Runs the cleanup now and then every 15 minutes (FR-019b). Returns a function that stops it. */
export function startSessionCleanup() {
  const run = () =>
    runSessionCleanup().catch((err) => console.error('session cleanup failed:', err))
  run()
  const timer = setInterval(run, INTERVAL_MS)
  timer.unref()
  return () => clearInterval(timer)
}
