// The live completeness check of the course editor (specs/005 FR-010 – FR-017, research R4,
// data-model.md § Melding). Pure: the editor recomputes it after every change. It never blocks
// saving; publishing (FR-09) will use the same rules later.
import { findNode, isEnd, outgoing } from './course'
import { LETTERS } from './util'

const MESSAGES = {
  empty: () => 'Voeg een onderdeel toe',
  noStart: () => 'Kies een startonderdeel',
  noEnd: () => 'De route heeft geen einde',
  unreachable: () => 'Niet bereikbaar vanaf de start',
  answerOpen: (letter) => `Antwoord ${letter} is nog niet verbonden`,
  neverEnds: () => 'Vanaf hier eindigt de route nooit',
  noVideo: () => 'Kies een video',
  videoUnavailable: () => 'Kies een andere video: deze is niet meer beschikbaar',
  noQuestion: () => 'Vul de vraag in',
  emptyAnswer: (letter) => `Antwoord ${letter} is leeg`,
}

/**
 * Checks a course. Returns { issues, byNode, complete }. Each issue is
 * { id, code, msg, nodeId?, answerId? } with a stable id `<code>:<nodeId>:<answerId>`.
 */
export function checkCourse(course, stepVideos = {}) {
  const issues = []
  const add = (code, nodeId = null, answerId = null, letter = null) => {
    const id = [code, nodeId, answerId].filter(Boolean).join(':')
    issues.push({ id, code, msg: MESSAGES[code](letter), nodeId, answerId })
  }

  if (!course.nodes.length) {
    add('empty')
    return result(issues)
  }

  // The rules of feature 004 per step (FR-015).
  for (const n of course.nodes) {
    if (n.type === 'video') {
      if (!n.videoId) add('noVideo', n.id)
      else if (stepVideos[n.videoId]?.available === false) add('videoUnavailable', n.id)
      continue
    }
    if (!n.question?.trim()) add('noQuestion', n.id)
    n.answers.forEach((a, i) => {
      if (!a.text?.trim()) add('emptyAnswer', n.id, a.id, LETTERS[i])
    })
    // FR-013: all answers continue, or none (then the question is an end).
    if (n.answers.some((a) => a.target)) {
      n.answers.forEach((a, i) => {
        if (!a.target) add('answerOpen', n.id, a.id, LETTERS[i])
      })
    }
  }

  // Without a start everything is unreachable: only ask for a start (FR-010, spec edge cases).
  const start = course.startId && findNode(course, course.startId)
  if (!start) {
    add('noStart')
    return result(issues)
  }

  // Reachable from the start (FR-012).
  const reach = new Set()
  const queue = [start.id]
  while (queue.length) {
    const id = queue.shift()
    const n = findNode(course, id)
    if (!n || reach.has(id)) continue
    reach.add(id)
    for (const o of outgoing(n)) queue.push(o.target)
  }
  for (const n of course.nodes) if (!reach.has(n.id)) add('unreachable', n.id)

  // Steps from which an end can be reached: the ends, then backwards to a fixed point (FR-011, FR-014).
  const canEnd = new Set(course.nodes.filter(isEnd).map((n) => n.id))
  if (![...canEnd].some((id) => reach.has(id))) add('noEnd')
  let changed = true
  while (changed) {
    changed = false
    for (const n of course.nodes) {
      if (!canEnd.has(n.id) && outgoing(n).some((o) => canEnd.has(o.target))) {
        canEnd.add(n.id)
        changed = true
      }
    }
  }
  for (const id of reach) if (!canEnd.has(id)) add('neverEnds', id)

  return result(issues)
}

/**
 * Groups of the "nog te doen" list (verbeterronde 005, punt 6). Every one of the ten message types
 * belongs to exactly one group; the course-level group comes first and stands apart.
 */
export const ISSUE_GROUPS = [
  { key: 'course', label: 'Cursus', courseLevel: true, codes: ['empty', 'noStart', 'noEnd'] },
  { key: 'answers', label: 'Antwoorden zonder vervolg', codes: ['answerOpen'] },
  { key: 'videos', label: 'Video-onderdelen zonder video', codes: ['noVideo', 'videoUnavailable'] },
  { key: 'unreachable', label: 'Onbereikbare onderdelen', codes: ['unreachable'] },
  { key: 'loops', label: 'Lussen zonder uitgang', codes: ['neverEnds'] },
  { key: 'texts', label: 'Lege vragen en antwoorden', codes: ['noQuestion', 'emptyAnswer'] },
]

/** The issues per group, in the order of ISSUE_GROUPS, leaving out empty groups. */
export function groupIssues(issues) {
  return ISSUE_GROUPS.map((group) => ({ ...group, issues: issues.filter((i) => group.codes.includes(i.code)) })).filter(
    (group) => group.issues.length > 0,
  )
}

function result(issues) {
  const byNode = {}
  for (const issue of issues) if (issue.nodeId) (byNode[issue.nodeId] ??= []).push(issue)
  return { issues, byNode, complete: issues.length === 0 }
}
