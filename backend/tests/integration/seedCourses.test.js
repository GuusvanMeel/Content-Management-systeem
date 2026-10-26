import { beforeEach, describe, expect, it } from 'vitest'
import { seedCourses } from '../../scripts/seed-courses.js'
import { agentWithSession, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

// The seed script for the performance check (specs/004 T055, SC-007).

let a
let agent

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
})

describe('seedCourses', () => {
  it('creates valid drafts that can be listed, opened and saved again', async () => {
    await createVideoRow({ organisationId: a.id })
    await seedCourses('zwembad-a', 3, 4)
    const courses = (await agent.get('/api/organisation/courses')).body.courses
    expect(courses).toHaveLength(3)
    expect(courses[0]).toMatchObject({ name: 'Testcursus 1', videoStepCount: 2, questionStepCount: 2 })
    const draft = (await agent.get(`/api/organisation/courses/${courses[0].id}`)).body
    expect(draft.steps.filter((s) => s.isStart)).toHaveLength(1)
    // What the editor would send back is accepted unchanged.
    const steps = draft.steps.map((step) => {
      const copy = { ...step, key: `s${step.id}` }
      delete copy.video
      delete copy.nextStepId
      if (copy.answers) copy.answers = copy.answers.map(({ nextStepId, ...answer }) => ({ ...answer, nextStepKey: nextStepId ? `s${nextStepId}` : null }))
      if (step.stepType === 'video') copy.nextStepKey = step.nextStepId ? `s${step.nextStepId}` : null
      return copy
    })
    expect((await agent.put(`/api/organisation/courses/${draft.id}`).send({ name: draft.name, description: draft.description, steps })).status).toBe(200)
  })

  it('uses only question steps without videos', async () => {
    await seedCourses('ZWEMBAD-A', 1, 3)
    const [course] = (await agent.get('/api/organisation/courses')).body.courses
    expect(course).toMatchObject({ videoStepCount: 0, questionStepCount: 3 })
  })

  it('refuses an unknown organisation', async () => {
    await expect(seedCourses('ONBEKEND', 1, 1)).rejects.toThrow('No active organisation with code ONBEKEND')
  })

  it('stays well within SC-007 with 50 courses of 50 steps (API part of the 2 seconds)', async () => {
    await createVideoRow({ organisationId: a.id })
    await seedCourses('ZWEMBAD-A', 50, 50)
    let start = performance.now()
    const courses = (await agent.get('/api/organisation/courses')).body.courses
    const listMs = performance.now() - start
    start = performance.now()
    const draft = (await agent.get(`/api/organisation/courses/${courses[0].id}`)).body
    const openMs = performance.now() - start
    expect(courses).toHaveLength(50)
    expect(draft.steps).toHaveLength(50)
    console.log(`SC-007 API timing: list ${listMs.toFixed(0)} ms, open ${openMs.toFixed(0)} ms`)
    expect(listMs).toBeLessThan(1000)
    expect(openMs).toBeLessThan(1000)
  }, 120000)
})
