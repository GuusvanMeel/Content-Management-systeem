import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { api } from '../src/api/client'
import { jsonResponse, mockSession, routerAt } from './helpers'

const expired = () =>
  jsonResponse(401, { error: { code: 'session_expired', message: 'Je sessie is verlopen. Log opnieuw in.' } })
const notAuthenticated = () =>
  jsonResponse(401, { error: { code: 'not_authenticated', message: 'Je bent niet ingelogd.' } })

describe('api client', () => {
  it('sends X-Requested-With: cms on every request', async () => {
    globalThis.fetch.mockResolvedValue(jsonResponse(200, { ok: true }))
    await api('/api/organisation')
    await api('/api/auth/logout', { method: 'POST' })
    for (const [, options] of globalThis.fetch.mock.calls) {
      expect(options.headers['X-Requested-With']).toBe('cms')
    }
  })

  it('turns the error format into an ApiError', async () => {
    globalThis.fetch.mockResolvedValue(
      jsonResponse(400, { error: { code: 'validation_failed', message: 'Fout', fields: { name: 'Vul een naam in.' } } }),
    )
    await expect(api('/api/admin/organisations', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      code: 'validation_failed',
      fields: { name: 'Vul een naam in.' },
    })
  })

  it('sends an expired session from /videos to /login with reason=expired', async () => {
    mockSession('organisation')
    const router = await routerAt('/videos')
    globalThis.fetch.mockImplementation(async () => expired())

    await expect(api('/api/organisation')).rejects.toMatchObject({ code: 'session_expired' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/videos', reason: 'expired' })
  })

  it('sends not_authenticated from /admin to /admin/login without a reason', async () => {
    mockSession('admin')
    const router = await routerAt('/admin')
    globalThis.fetch.mockImplementation(async () => notAuthenticated())

    await expect(api('/api/admin/organisations')).rejects.toMatchObject({ code: 'not_authenticated' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/admin' })
  })

  it('does not navigate on a 401 from a login request', async () => {
    mockSession('none')
    const router = await routerAt('/login')
    globalThis.fetch.mockImplementation(async () =>
      jsonResponse(401, { error: { code: 'invalid_credentials', message: 'Organisatiecode of wachtwoord onjuist.' } }),
    )

    await expect(
      api('/api/auth/organisation/login', { method: 'POST', body: { loginCode: 'X', password: 'y' } }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' })
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/login')
  })
})
