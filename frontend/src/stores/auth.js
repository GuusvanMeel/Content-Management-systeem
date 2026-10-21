import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

export const useAuth = defineStore('auth', () => {
  const role = ref(null)
  const username = ref(null)
  const organisation = ref(null)
  const loaded = ref(false)
  // Error code of the last failed fetchMe, e.g. 'session_expired'.
  const lastErrorCode = ref(null)

  function reset() {
    role.value = null
    username.value = null
    organisation.value = null
  }

  /** Loads the current session. Without a valid session the state is simply empty. */
  async function fetchMe() {
    try {
      const me = await api('/api/auth/me')
      role.value = me.role
      username.value = me.username ?? null
      organisation.value = me.organisation ?? null
      lastErrorCode.value = null
    } catch (error) {
      reset()
      lastErrorCode.value = error.code ?? null
    } finally {
      loaded.value = true
    }
  }

  async function loginAdmin(name, password) {
    await api('/api/auth/admin/login', { method: 'POST', body: { username: name, password } })
    await fetchMe()
  }

  async function loginOrganisation(loginCode, password) {
    await api('/api/auth/organisation/login', { method: 'POST', body: { loginCode, password } })
    await fetchMe()
  }

  /** Logs out and returns the login page to go to. */
  async function logout() {
    const target = role.value === 'admin' ? '/admin/login' : '/login'
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } finally {
      reset()
    }
    return { path: target, query: { reason: 'logout' } }
  }

  return { role, username, organisation, loaded, lastErrorCode, reset, fetchMe, loginAdmin, loginOrganisation, logout }
})
