import { describe, expect, it } from 'vitest'
import { safeRedirect } from '../src/lib/redirect'
import { jsonResponse, mockSession, routerAt } from './helpers'

describe('route guards (contracts/ui.md)', () => {
  it.each(['/admin', '/admin/organisations/new'])('sends an organisation from %s to /admin/login', async (path) => {
    mockSession('organisation')
    const router = await routerAt(path)
    expect(router.currentRoute.value.path).toBe('/admin/login')
  })

  it.each([
    ['/', '/'],
    ['/videos', '/videos'],
  ])('sends a visitor without a session from %s to /login', async (path, redirect) => {
    mockSession('none')
    const router = await routerAt(path)
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe(redirect)
  })

  it('sends a logged-in administrator from /admin/login to /admin', async () => {
    mockSession('admin')
    const router = await routerAt('/admin/login')
    expect(router.currentRoute.value.path).toBe('/admin')
  })

  it('sends a logged-in organisation from /login to /', async () => {
    mockSession('organisation')
    const router = await routerAt('/login')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('sends an administrator from organisation screens to /login', async () => {
    mockSession('admin')
    const router = await routerAt('/settings/style')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('shows the expired message when the session expired before navigating (FR-019a)', async () => {
    mockSession('organisation')
    const router = await routerAt('/')
    globalThis.fetch.mockImplementation(async () =>
      jsonResponse(401, { error: { code: 'session_expired', message: 'Je sessie is verlopen. Log opnieuw in.' } }),
    )
    await router.push('/settings/style')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/settings/style', reason: 'expired' })
  })

  it('checks the session on every protected navigation', async () => {
    mockSession('organisation')
    const router = await routerAt('/')
    await router.push('/videos')
    await router.push('/settings/style')
    const meCalls = globalThis.fetch.mock.calls.filter(([url]) => url === '/api/auth/me')
    expect(meCalls).toHaveLength(3)
  })

  it('redirects the old /organisation route to /settings/style', async () => {
    mockSession('organisation')
    const router = await routerAt('/organisation')
    expect(router.currentRoute.value.path).toBe('/settings/style')
  })
})

describe('safeRedirect', () => {
  it('only allows paths inside the environment that was logged in to', () => {
    expect(safeRedirect('/videos', { admin: false })).toBe('/videos')
    expect(safeRedirect('/admin/log', { admin: true })).toBe('/admin/log')
    expect(safeRedirect('/admin', { admin: false })).toBeNull()
    expect(safeRedirect('/videos', { admin: true })).toBeNull()
    expect(safeRedirect('//evil.example', { admin: false })).toBeNull()
    expect(safeRedirect('https://evil.example', { admin: false })).toBeNull()
  })
})
