import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../src/router'

export function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const ME = {
  admin: { role: 'admin', username: 'beheer' },
  organisation: { role: 'organisation', organisation: { id: 3, name: 'Zwembad A', loginCode: 'ZWEMBAD-A' } },
  none: null,
}

/** Mocks GET /api/auth/me for the given session kind; other calls answer with `otherResponse`. */
export function mockSession(kind, otherResponse = () => jsonResponse(200, {})) {
  globalThis.fetch.mockImplementation(async (url) => {
    if (url === '/api/auth/me') {
      return ME[kind]
        ? jsonResponse(200, ME[kind])
        : jsonResponse(401, { error: { code: 'not_authenticated', message: 'Je bent niet ingelogd.' } })
    }
    return otherResponse(url)
  })
}

export async function routerAt(path) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  return router
}
