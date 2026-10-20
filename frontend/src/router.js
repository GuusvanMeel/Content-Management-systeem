import { createRouter, createWebHashHistory } from 'vue-router'
import CoursesView from './views/CoursesView.vue'
import EditorView from './views/EditorView.vue'
import VideosView from './views/VideosView.vue'
import OrganisationView from './views/OrganisationView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/cursussen' },
    { path: '/cursussen', component: CoursesView },
    { path: '/cursussen/:id', component: EditorView, props: true },
    { path: '/videos', component: VideosView },
    { path: '/organisatie', component: OrganisationView },
  ],
})
