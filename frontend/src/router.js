import { createRouter, createWebHistory } from 'vue-router'
import { onUnauthorized } from './api/client'
import { useAuth } from './stores/auth'
import AdminLayout from './components/AdminLayout.vue'
import OrganisationLayout from './components/OrganisationLayout.vue'
import AdminLoginView from './views/AdminLoginView.vue'
import LoginView from './views/LoginView.vue'
import HomeView from './views/HomeView.vue'
import StyleSettingsView from './views/StyleSettingsView.vue'
import CoursesView from './views/CoursesView.vue'
import EditorView from './views/EditorView.vue'
import VideosView from './views/VideosView.vue'
import ActionLogView from './views/admin/ActionLogView.vue'
import OrganisationFormView from './views/admin/OrganisationFormView.vue'
import OrganisationListView from './views/admin/OrganisationListView.vue'

// Routes and guards from contracts/ui.md. The guards are a convenience; the API enforces access.
export const routes = [
  { path: '/login', component: LoginView, meta: { guestOnly: true } },
  { path: '/admin/login', component: AdminLoginView, meta: { guestOnly: true } },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAdmin: true },
    children: [
      { path: '', component: OrganisationListView },
      { path: 'organisations/new', component: OrganisationFormView },
      { path: 'organisations/:id', component: OrganisationFormView, props: true },
      { path: 'log', component: ActionLogView },
    ],
  },
  {
    path: '/',
    component: OrganisationLayout,
    meta: { requiresOrganisation: true },
    children: [
      { path: '', component: HomeView },
      // Course and video screens are still the browser-only prototype (outside this feature).
      { path: 'courses', component: CoursesView },
      { path: 'courses/:id', component: EditorView, props: true },
      { path: 'videos', component: VideosView },
      { path: 'settings/style', component: StyleSettingsView },
      { path: 'organisation', redirect: '/settings/style' },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const isAdminPath = (path) => path === '/admin' || path.startsWith('/admin/')

export function installGuards(router) {
  router.beforeEach(async (to) => {
    const auth = useAuth()
    const requiresAdmin = to.matched.some((r) => r.meta.requiresAdmin)
    const requiresOrganisation = to.matched.some((r) => r.meta.requiresOrganisation)

    // Navigating counts as activity (contracts/ui.md): every protected navigation checks the
    // session with the API, which also extends it. That way an expired session is noticed on
    // screens that do not call the API themselves (FR-019a).
    if (!auth.loaded || requiresAdmin || requiresOrganisation) await auth.fetchMe()
    const loginQuery = { redirect: to.fullPath }
    if (auth.lastErrorCode === 'session_expired') loginQuery.reason = 'expired'

    if (requiresAdmin && auth.role !== 'admin') return { path: '/admin/login', query: loginQuery }
    if (requiresOrganisation && auth.role !== 'organisation') return { path: '/login', query: loginQuery }
    if (to.meta.guestOnly) {
      if (to.path === '/admin/login' && auth.role === 'admin') return '/admin'
      if (to.path === '/login' && auth.role === 'organisation') return '/'
    }
  })

  // A 401 from the API outside the login requests: back to the right login page, and back here
  // after logging in again. Only an expired session shows a message (FR-019a).
  onUnauthorized((error) => {
    useAuth().reset()
    const current = router.currentRoute.value
    const target = isAdminPath(current.path) ? '/admin/login' : '/login'
    if (current.path === target) return
    const query = { redirect: current.fullPath }
    if (error.code === 'session_expired') query.reason = 'expired'
    router.push({ path: target, query })
  })
  return router
}

export function createAppRouter(history = createWebHistory()) {
  return installGuards(createRouter({ history, routes }))
}

export const router = createAppRouter()
