import { access, unlink } from 'node:fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { runVideoFileCleanup } from '../../src/jobs/videoFileCleanup.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import { agentWithSession, createCourseRow, createOrganisationRow, createStepRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

// Removing the files of soft-deleted videos from disk (specs/002 FR-020a, research R16).

let a

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
})

const exists = (key) =>
  access(videoStorage.getPath(key)).then(
    () => true,
    () => false,
  )
const filesOf = async (video) => [await exists(video.storageKey), await exists(video.thumbnailStorageKey)]

describe('video file cleanup', () => {
  it('removes both files of a soft-deleted video that no course step references, and keeps the row', async () => {
    const video = await createVideoRow({ organisationId: a.id, deletedAt: new Date() })
    expect(await filesOf(video)).toEqual([true, true])
    expect(await runVideoFileCleanup()).toBe(2)
    expect(await filesOf(video)).toEqual([false, false])
    const after = await db('Video').where({ id: video.id }).first()
    expect(after.deletedAt).not.toBeNull()
    expect(after.storageKey).toBe(video.storageKey)
  })

  it('leaves videos that are not deleted alone', async () => {
    const video = await createVideoRow({ organisationId: a.id })
    expect(await runVideoFileCleanup()).toBe(0)
    expect(await filesOf(video)).toEqual([true, true])
  })

  it('keeps a deleted video that a course still uses, and removes it once the last step is gone', async () => {
    const video = await createVideoRow({ organisationId: a.id, visibility: 'private' })
    const course = await createCourseRow({ organisationId: a.id })
    const step = await createStepRow({ versionId: course.versionId, videoId: video.id, isStart: true })
    await db('Video').where({ id: video.id }).update({ deletedAt: new Date() })

    expect(await runVideoFileCleanup()).toBe(0)
    expect(await filesOf(video)).toEqual([true, true])
    // The course thumbnail route still works for the step (specs/004 FR-016a).
    const { agent } = await agentWithSession({ organisationId: a.id })
    const thumbnail = await agent.get(`/api/organisation/courses/${course.courseId}/steps/${step.id}/videos/${video.id}/thumbnail`)
    expect(thumbnail.status).toBe(200)

    // The teacher removes the step and saves; the next run removes the files.
    const saved = await agent.put(`/api/organisation/courses/${course.courseId}`).send({ name: 'Cursus', description: 'D', steps: [] })
    expect(saved.status).toBe(200)
    expect(await runVideoFileCleanup()).toBe(2)
    expect(await filesOf(video)).toEqual([false, false])
  })

  it('keeps a deleted video that only a step of a soft-deleted course still references', async () => {
    const video = await createVideoRow({ organisationId: a.id, deletedAt: new Date() })
    const course = await createCourseRow({ organisationId: a.id, deletedAt: new Date() })
    await createStepRow({ versionId: course.versionId, videoId: video.id, isStart: true })
    expect(await runVideoFileCleanup()).toBe(0)
    expect(await filesOf(video)).toEqual([true, true])
  })

  it('handles files that are already gone and a video without a thumbnail', async () => {
    const gone = await createVideoRow({ organisationId: a.id, deletedAt: new Date() })
    await unlink(videoStorage.getPath(gone.storageKey))
    await unlink(videoStorage.getPath(gone.thumbnailStorageKey))
    const noThumb = await createVideoRow({ organisationId: a.id, deletedAt: new Date() })
    await db('Video').where({ id: noThumb.id }).update({ thumbnailStorageKey: null })
    // Only the video file of noThumb is still there to remove.
    expect(await runVideoFileCleanup()).toBe(1)
    expect(await exists(noThumb.storageKey)).toBe(false)
    // The thumbnail file of noThumb is not referenced any more, so it is left as it was.
    expect(await exists(noThumb.thumbnailStorageKey)).toBe(true)
    // A later run finds nothing left to remove.
    expect(await runVideoFileCleanup()).toBe(0)
  })
})
