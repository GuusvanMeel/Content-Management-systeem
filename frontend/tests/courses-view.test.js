import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import CoursesView from '../src/views/CoursesView.vue'
import { jsonResponse } from './helpers'

// The course list (specs/004 US1, contracts/ui.md § Cursussen).

const COURSE = {
  id: 12,
  name: 'Redding in het diepe bad',
  updatedAt: new Date().toISOString(),
  videoStepCount: 1,
  questionStepCount: 2,
  status: 'draft',
}

/** Answers the API calls of the view; `post` handles POST /courses. */
function mockApi({ courses = [], post } = {}) {
  globalThis.fetch.mockImplementation(async (url, options = {}) => {
    if (url === '/api/organisation/courses' && (options.method ?? 'GET') === 'GET') return jsonResponse(200, { courses })
    if (url === '/api/organisation/courses' && options.method === 'POST') return post(JSON.parse(options.body))
    return jsonResponse(404, { error: { code: 'not_found', message: 'Niet gevonden.' } })
  })
}

async function mountView() {
  const Blank = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/courses', component: CoursesView },
      { path: '/courses/:id', component: Blank },
    ],
  })
  await router.push('/courses')
  const wrapper = mount(CoursesView, { global: { plugins: [router], stubs: { teleport: true } }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

const posts = () => globalThis.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')

describe('CoursesView', () => {
  it('shows the empty state with a button for the first course', async () => {
    mockApi()
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Er zijn nog geen cursussen.')
    expect(wrapper.text()).toContain('Maak de eerste cursus')
    wrapper.unmount()
  })

  it('shows each course with its counts and the status Concept', async () => {
    mockApi({ courses: [COURSE] })
    const { wrapper } = await mountView()
    const row = wrapper.find('.row')
    expect(row.text()).toContain('Redding in het diepe bad')
    expect(row.text()).toContain('1 video · 2 vragen')
    expect(row.text()).toContain('Concept')
    expect(row.text()).not.toContain('te doen')
    wrapper.unmount()
  })

  it('shows a load error with a retry button', async () => {
    globalThis.fetch.mockResolvedValue(jsonResponse(500, { error: { code: 'internal_error', message: 'Er ging iets mis.' } }))
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('De cursussen konden niet worden geladen.')
    mockApi({ courses: [COURSE] })
    await wrapper.findAll('button').find((b) => b.text() === 'Opnieuw').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Redding in het diepe bad')
    wrapper.unmount()
  })

  it('does not create a course with empty fields and marks them', async () => {
    mockApi({ post: () => jsonResponse(201, {}) })
    const { wrapper } = await mountView()
    await wrapper.findAll('button').find((b) => b.text().includes('Nieuwe cursus')).trigger('click')
    await wrapper.find('form#new-course').trigger('submit')
    await flushPromises()
    expect(posts()).toHaveLength(0)
    expect(wrapper.find('[data-test="create-error"]').text()).toBe('Vul een naam en een beschrijving in.')
    expect(wrapper.find('[data-test="course-name"]').classes()).toContain('invalid')
    expect(wrapper.find('[data-test="course-description"]').classes()).toContain('invalid')
    wrapper.unmount()
  })

  it('creates the course and opens the editor', async () => {
    mockApi({ post: (body) => jsonResponse(201, { id: 31, ...body, status: 'draft', steps: [] }) })
    const { wrapper, router } = await mountView()
    await wrapper.findAll('button').find((b) => b.text().includes('Nieuwe cursus')).trigger('click')
    await wrapper.find('[data-test="course-name"]').setValue('  Nieuwe cursus  ')
    await wrapper.find('[data-test="course-description"]').setValue('Uitleg')
    await wrapper.find('form#new-course').trigger('submit')
    await flushPromises()
    expect(JSON.parse(posts()[0][1].body)).toEqual({ name: 'Nieuwe cursus', description: 'Uitleg' })
    expect(router.currentRoute.value.path).toBe('/courses/31')
    wrapper.unmount()
  })

  it('shows the counters and the server message for a name that is too long', async () => {
    mockApi({
      post: () =>
        jsonResponse(400, {
          error: { code: 'validation_failed', message: 'Controleer de ingevulde gegevens.', fields: { name: 'De naam mag maximaal 255 tekens lang zijn.' } },
        }),
    })
    const { wrapper } = await mountView()
    await wrapper.findAll('button').find((b) => b.text().includes('Nieuwe cursus')).trigger('click')
    expect(wrapper.find('[data-test="course-name-counter"]').text()).toBe('255 tekens over')
    expect(wrapper.find('[data-test="course-description-counter"]').text()).toBe('1000 tekens over')
    await wrapper.find('[data-test="course-name"]').setValue('Naam')
    await wrapper.find('[data-test="course-description"]').setValue('Uitleg')
    await wrapper.find('form#new-course').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-test="create-error"]').text()).toBe('De naam mag maximaal 255 tekens lang zijn.')
    wrapper.unmount()
  })
})
