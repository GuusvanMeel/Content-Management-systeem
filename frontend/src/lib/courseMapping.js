// Converts between the draft document of the API (specs/004 and specs/005 contracts/api.md) and
// the editor model of lib/course.js (specs/004 research R9, specs/005 research R1).
//
// Editor keys: a saved step is 's<id>', a saved answer 'a<id>'. New steps and answers get a
// temporary uid() key (with an underscore), so the two can never be confused.

const stepKey = (id) => `s${id}`
const answerKey = (id) => `a${id}`
const serverId = (key) => Number(key.slice(1))
const nextKey = (id) => (id ? stepKey(id) : null)

/**
 * The editor model and the video details per video id. The video details stay out of the course,
 * so they are not part of undo or of the "unsaved changes" check (research R5b).
 */
export function toEditor(doc) {
  const stepVideos = {}
  const nodes = doc.steps.map((step) => {
    const base = { id: stepKey(step.id), type: step.stepType, x: step.positionX, y: step.positionY }
    if (step.stepType === 'video') {
      if (step.video) {
        const { name, durationSeconds, thumbnailUrl, available } = step.video
        stepVideos[step.videoId] = { name, durationSeconds, thumbnailUrl, available }
      }
      return { ...base, videoId: step.videoId, next: nextKey(step.nextStepId) }
    }
    return {
      ...base,
      question: step.questionText ?? '',
      feedback: step.feedback ?? '',
      answers: step.answers.map((answer) => ({
        id: answerKey(answer.id),
        text: answer.answerText,
        correct: answer.isCorrect,
        target: nextKey(answer.nextStepId),
      })),
    }
  })
  const start = doc.steps.find((step) => step.isStart)
  const course = {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    startId: start ? stepKey(start.id) : null,
    nodes,
  }
  return { course, stepVideos }
}

/** The keys of every step and answer in a saved draft document. */
export function savedKeys(doc) {
  const keys = new Set()
  for (const step of doc.steps) {
    keys.add(stepKey(step.id))
    for (const answer of step.answers ?? []) keys.add(answerKey(answer.id))
  }
  return keys
}

/** The video of every saved video step, by editor key (specs/004 FR-020d, research R5b). */
export function savedVideos(doc) {
  const videos = new Map()
  for (const step of doc.steps) if (step.stepType === 'video') videos.set(stepKey(step.id), step.videoId)
  return videos
}

/**
 * Maps the editor keys of `course`, as it was sent with `saved` as the known keys, to the keys
 * of the returned draft `doc` (research R10). Known steps keep their key. New steps were
 * inserted in the order of the request, so they got ascending ids: the n-th new node is the n-th
 * new step in `doc`. Answers are matched by position within their step (sortOrder).
 */
export function keyChanges(course, doc, saved) {
  const changes = {}
  const stepByKey = new Map(doc.steps.map((step) => [stepKey(step.id), step]))
  const newSteps = doc.steps.filter((step) => !saved.has(stepKey(step.id))).sort((x, y) => x.id - y.id)
  let next = 0
  for (const node of course.nodes) {
    const step = saved.has(node.id) ? stepByKey.get(node.id) : newSteps[next++]
    if (!step) continue
    changes[node.id] = stepKey(step.id)
    node.answers?.forEach((answer, j) => {
      if (step.answers?.[j]) changes[answer.id] = answerKey(step.answers[j].id)
    })
  }
  return changes
}

/**
 * Renames step and answer keys of an editor course in place, using `changes` (old → new),
 * including the connections that point to renamed steps.
 */
export function applyKeyChanges(course, changes) {
  if (changes[course.startId]) course.startId = changes[course.startId]
  for (const node of course.nodes) {
    if (changes[node.id]) node.id = changes[node.id]
    if (changes[node.next]) node.next = changes[node.next]
    for (const answer of node.answers ?? []) {
      if (changes[answer.id]) answer.id = changes[answer.id]
      if (changes[answer.target]) answer.target = changes[answer.target]
    }
  }
  return course
}

/**
 * The request body for "Opslaan als concept". Only keys that exist in the last saved draft
 * (`saved`) are sent as ids; everything else is new, also a step that came back through undo
 * after its removal was saved (research R10).
 */
export function toPayload(course, saved) {
  const idOf = (key) => (saved.has(key) ? { id: serverId(key) } : {})
  return {
    name: course.name,
    description: course.description,
    steps: course.nodes.map((node) => {
      // The editor key is the request key; connections point to keys (specs/005 research R1).
      const base = {
        key: node.id,
        ...idOf(node.id),
        stepType: node.type,
        isStart: course.startId === node.id,
        positionX: Math.round(node.x),
        positionY: Math.round(node.y),
      }
      if (node.type === 'video') return { ...base, videoId: node.videoId ?? null, nextStepKey: node.next ?? null }
      return {
        ...base,
        questionText: node.question ?? '',
        feedback: node.feedback ? node.feedback : null,
        answers: node.answers.map((answer) => ({
          ...idOf(answer.id),
          answerText: answer.text ?? '',
          isCorrect: !!answer.correct,
          nextStepKey: answer.target ?? null,
        })),
      }
    }),
  }
}
