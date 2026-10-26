// Creates test courses for one organisation, to check that the course list and a large draft stay
// fast (specs/004 SC-007, quickstart.md § Prestatie):
//   docker compose exec -e NODE_ENV=development api node scripts/seed-courses.js <loginCode> <courses> <stepsPerCourse>
// Development only: refuses to run with NODE_ENV=production. Video steps use videos the
// organisation already sees in its library; without any, every step is a question step.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../src/config/env.js'
import { db } from '../src/db/knex.js'
import { visibleVideosQuery } from '../src/modules/videos/videoRepository.js'

const ANSWERS = ['Alarmeren', 'Het water in springen', 'Een collega roepen']

/** Inserts `courses` drafts with `stepsPerCourse` steps each. Returns the organisation id. */
export async function seedCourses(loginCode, courses, stepsPerCourse) {
  if (config.NODE_ENV === 'production') throw new Error('seed-courses must not run in production')
  const organisation = await db('Organisation')
    .where({ loginCode: String(loginCode).trim().toUpperCase() })
    .whereNull('deletedAt')
    .first()
  if (!organisation) throw new Error(`No active organisation with code ${loginCode}`)
  const videoIds = (await visibleVideosQuery(organisation.id).clearSelect().select('v.id').limit(50)).map((row) => row.id)

  for (let c = 1; c <= courses; c++) {
    await db.transaction(async (trx) => {
      const now = new Date(Date.now() - c * 60 * 1000)
      const [courseId] = await trx('Course').insert({ isSharedInLibrary: false, createdAt: now, updatedAt: now })
      await trx('OrganisationCourse').insert({ organisationId: organisation.id, courseId, isOwner: true, addedAt: now })
      const [courseVersionId] = await trx('CourseVersion').insert({
        courseId,
        versionNumber: 1,
        name: `Testcursus ${c}`,
        description: `Cursus met ${stepsPerCourse} onderdelen om de snelheid te testen.`,
        publishedAt: null,
      })
      for (let s = 0; s < stepsPerCourse; s++) {
        // Alternate video and question steps, in one column on the canvas.
        const isVideo = videoIds.length > 0 && s % 2 === 0
        const position = { positionX: 0, positionY: s * 260 }
        if (isVideo) {
          await trx('CourseStep').insert({
            courseVersionId,
            stepType: 'video',
            isStart: s === 0,
            videoId: videoIds[s % videoIds.length],
            ...position,
          })
          continue
        }
        const [stepId] = await trx('CourseStep').insert({
          courseVersionId,
          stepType: 'question',
          isStart: s === 0,
          questionText: `Wat doe je bij situatie ${s + 1}?`,
          feedback: null,
          ...position,
        })
        await trx('Answer').insert(
          ANSWERS.map((answerText, sortOrder) => ({ courseStepId: stepId, answerText, isCorrect: sortOrder === 0, sortOrder })),
        )
      }
    })
  }
  return organisation.id
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [loginCode, rawCourses = '50', rawSteps = '50'] = process.argv.slice(2)
  const courses = Number(rawCourses)
  const steps = Number(rawSteps)
  // At most 200 steps per draft, like the save route (specs/004 research R4).
  if (!loginCode || !Number.isInteger(courses) || courses <= 0 || !Number.isInteger(steps) || steps <= 0 || steps > 200) {
    console.error('Usage: node scripts/seed-courses.js <loginCode> <courses> <stepsPerCourse (1-200)>')
    process.exit(1)
  }
  try {
    await seedCourses(loginCode, courses, steps)
    console.log(`Created ${courses} test courses with ${steps} steps each for ${loginCode}.`)
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  } finally {
    await db.destroy()
  }
}
