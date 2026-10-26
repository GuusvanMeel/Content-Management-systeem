// Pure helpers for a course draft in the editor (specs/004 research R9, specs/005 research R6).
//
// Data model (see lib/courseMapping.js for the conversion from and to the API)
//   course        = { id, name, description, startId, nodes: [...] }
//   video node    = { id, type: 'video', x, y, videoId, next }                  next: nodeId | null
//   question node = { id, type: 'question', x, y, question, feedback, answers: [{ id, text, correct, target }] }
// A step without any next step is an end (specs/005 FR-005); there is no end marking.
import dagre from '@dagrejs/dagre'
import { uid, LETTERS } from './util'

export const NODE_W = { video: 220, question: 240 }
const NODE_H = { video: 180, questionBase: 80, perAnswer: 30 }
const GAP = 60

export function findNode(course, id) {
  return course.nodes.find((n) => n.id === id)
}

/** Outgoing links as [{ handle, target, answer? }]; the handle of a video is 'next', of an answer 'a-<id>'. */
export function outgoing(node) {
  if (node.type === 'video') return node.next ? [{ handle: 'next', target: node.next }] : []
  return node.answers.filter((a) => a.target).map((a) => ({ handle: 'a-' + a.id, target: a.target, answer: a }))
}

export function incoming(course, id) {
  const res = []
  for (const n of course.nodes) for (const o of outgoing(n)) if (o.target === id) res.push({ from: n, ...o })
  return res
}

/** A video without a next step, or a question of which no answer has a next step (FR-005). */
export const isEnd = (node) => outgoing(node).length === 0

/** Breadth-first from the start step; steps that cannot be reached come last, top to bottom. */
export function orderedNodes(course) {
  const seen = new Set()
  const order = []
  const queue = course.startId ? [course.startId] : []
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    const n = findNode(course, id)
    if (!n) continue
    seen.add(id)
    order.push(n)
    for (const o of outgoing(n)) queue.push(o.target)
  }
  const loose = course.nodes.filter((n) => !seen.has(n.id)).sort((a, b) => a.y - b.y || a.x - b.x)
  return [...order, ...loose]
}

/** The name of a step: its video or its question (specs/004 FR-017a). */
export function nodeLabel(node, stepVideos = {}) {
  if (!node) return ''
  if (node.type === 'video') return (node.videoId && stepVideos[node.videoId]?.name) || 'Kies een video'
  return node.question || 'Nieuwe vraag'
}

export function newVideoNode(pos = { x: 0, y: 0 }) {
  return { id: uid('n'), type: 'video', x: pos.x, y: pos.y, videoId: null, next: null }
}

export function newQuestionNode(pos = { x: 0, y: 0 }) {
  return {
    id: uid('q'),
    type: 'question',
    x: pos.x,
    y: pos.y,
    question: '',
    feedback: '',
    answers: [
      { id: uid('a'), text: '', correct: true, target: null },
      { id: uid('a'), text: '', correct: false, target: null },
    ],
  }
}

/** Adds a step; the first step of an empty course becomes the start step (specs/004 FR-018). */
export function addNode(course, type, pos) {
  const node = type === 'video' ? newVideoNode(pos) : newQuestionNode(pos)
  if (!course.nodes.length) course.startId = node.id
  course.nodes.push(node)
  return node
}

const answerOf = (node, handle) => node.answers?.find((a) => 'a-' + a.id === handle)

/** Position for a new step under `source`; answers spread out side by side. */
export function positionBelow(course, source, handle) {
  if (!source) return { x: 0, y: 0 }
  let dx = 0
  if (source.type === 'question') {
    const i = source.answers.findIndex((a) => 'a-' + a.id === handle)
    const n = source.answers.length
    dx = (i - (n - 1) / 2) * 260
  }
  const h = source.type === 'question' ? 90 + source.answers.length * 30 : 190
  let pos = { x: source.x + dx + (NODE_W[source.type] - NODE_W.video) / 2, y: source.y + h + 70 }
  // Nudge right while overlapping an existing step.
  for (let guard = 0; guard < 20; guard++) {
    const hit = course.nodes.some((n) => Math.abs(n.x - pos.x) < 200 && Math.abs(n.y - pos.y) < 140)
    if (!hit) break
    pos = { x: pos.x + 250, y: pos.y }
  }
  return { x: Math.round(pos.x), y: Math.round(pos.y) }
}

/** Points a handle to a step; replaces an earlier connection. A video cannot point to itself (FR-003). */
export function connect(course, sourceId, handle, targetId) {
  const src = findNode(course, sourceId)
  if (!src || !findNode(course, targetId)) return false
  if (src.type === 'video') {
    if (targetId === sourceId) return false
    src.next = targetId
    return true
  }
  const a = answerOf(src, handle)
  if (!a) return false
  a.target = targetId
  return true
}

export function disconnect(course, sourceId, handle) {
  const src = findNode(course, sourceId)
  if (!src) return
  if (src.type === 'video') src.next = null
  else {
    const a = answerOf(src, handle)
    if (a) a.target = null
  }
}

/** The step a handle points to, or null. */
export function targetOf(course, sourceId, handle) {
  const src = findNode(course, sourceId)
  if (!src) return null
  return src.type === 'video' ? src.next : (answerOf(src, handle)?.target ?? null)
}

/**
 * Creates a step and connects it from (sourceId, handle) in one go (FR-020). If that handle already
 * pointed somewhere, the new step comes in between: a new video points to the old next step, a new
 * question does so through its correct answer (specs/005 clarify Q2).
 */
export function addLinkedNode(course, sourceId, handle, type, pos) {
  const src = findNode(course, sourceId)
  const previous = targetOf(course, sourceId, handle)
  const node = addNode(course, type, pos ?? positionBelow(course, src, handle))
  if (src) connect(course, sourceId, handle, node.id)
  if (previous) {
    if (node.type === 'video') node.next = previous
    else node.answers.find((a) => a.correct).target = previous
  }
  return node
}

/** Removes a step and every connection to it (FR-006); without it the course may have no start. */
export function deleteNode(course, id) {
  course.nodes = course.nodes.filter((n) => n.id !== id)
  for (const n of course.nodes) {
    if (n.type === 'video' && n.next === id) n.next = null
    if (n.type === 'question') n.answers.forEach((a) => a.target === id && (a.target = null))
  }
  if (course.startId === id) course.startId = null
}

export function addAnswer(node) {
  if (node.answers.length >= 4) return
  node.answers.push({ id: uid('a'), text: '', correct: false, target: null })
}

export function removeAnswer(node, answerId) {
  if (node.answers.length <= 2) return
  const wasCorrect = node.answers.find((a) => a.id === answerId)?.correct
  node.answers = node.answers.filter((a) => a.id !== answerId)
  if (wasCorrect) node.answers[0].correct = true
}

export function setCorrect(node, answerId) {
  node.answers.forEach((a) => (a.correct = a.id === answerId))
}

export const answerLetter = (node, answerId) => LETTERS[node.answers.findIndex((a) => a.id === answerId)] ?? '?'

const nodeHeight = (n) => (n.type === 'video' ? NODE_H.video : NODE_H.questionBase + n.answers.length * NODE_H.perAnswer)

/** "Canvas ordenen" along the route, top to bottom, branches side by side (FR-025). */
export function autoLayout(course, dims = {}) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: GAP, ranksep: 64, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of course.nodes) g.setNode(n.id, dims[n.id] ?? { width: NODE_W[n.type], height: nodeHeight(n) })
  for (const n of course.nodes) for (const o of outgoing(n)) if (o.target !== n.id) g.setEdge(n.id, o.target)
  dagre.layout(g)
  for (const n of course.nodes) {
    const p = g.node(n.id)
    n.x = Math.round(p.x - p.width / 2)
    n.y = Math.round(p.y - p.height / 2)
  }
  // Steps that cannot be reached go under the route, in one row.
  const reached = new Set(orderedNodes(course).slice(0, reachableCount(course)).map((n) => n.id))
  const loose = course.nodes.filter((n) => !reached.has(n.id))
  if (!loose.length || reached.size === 0) return
  const bottom = Math.max(...course.nodes.filter((n) => reached.has(n.id)).map((n) => n.y + nodeHeight(n)))
  loose.forEach((n, i) => {
    n.x = 20 + i * (NODE_W.question + GAP)
    n.y = bottom + 2 * GAP
  })
}

function reachableCount(course) {
  const seen = new Set()
  const queue = course.startId ? [course.startId] : []
  while (queue.length) {
    const id = queue.shift()
    const n = findNode(course, id)
    if (!n || seen.has(id)) continue
    seen.add(id)
    for (const o of outgoing(n)) queue.push(o.target)
  }
  return seen.size
}
