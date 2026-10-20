// Pure helpers for the course graph.
//
// Data model
//   course = { id, orgId, name, description, startId, nodes: [...], published, publishedVersion, publishedSnapshot }
//   video node    = { id, type: 'video', x, y, title, description, videoId, next }        next: nodeId | null  (null = end)
//   question node = { id, type: 'question', x, y, question, answers: [{ id, text, correct, target }] }
import dagre from '@dagrejs/dagre'
import { uid, LETTERS } from './util'

export const NODE_W = { video: 220, question: 240 }

export function findNode(course, id) {
  return course.nodes.find((n) => n.id === id)
}

/** Outgoing links as [{ handle, target, answer? }] */
export function outgoing(node) {
  if (node.type === 'video') return node.next ? [{ handle: 'next', target: node.next }] : []
  return node.answers.filter((a) => a.target).map((a) => ({ handle: 'a-' + a.id, target: a.target, answer: a }))
}

export function incoming(course, id) {
  const res = []
  for (const n of course.nodes) for (const o of outgoing(n)) if (o.target === id) res.push({ from: n, ...o })
  return res
}

export const isEnd = (node) => node.type === 'video' && !node.next

/** Breadth-first order from the start node; unreachable nodes are appended. */
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
  for (const n of course.nodes) if (!seen.has(n.id)) order.push(n)
  return order
}

export function numbering(course) {
  const map = {}
  orderedNodes(course).forEach((n, i) => (map[n.id] = i + 1))
  return map
}

export function nodeLabel(node, videosById = {}) {
  if (!node) return ''
  if (node.type === 'video') return node.title || videosById[node.videoId]?.name || 'Nieuw onderdeel'
  return node.question || 'Nieuwe vraag'
}

export function newVideoNode(pos = { x: 0, y: 0 }, extra = {}) {
  return { id: uid('n'), type: 'video', x: pos.x, y: pos.y, title: '', description: '', videoId: null, next: null, ...extra }
}

export function newQuestionNode(pos = { x: 0, y: 0 }, extra = {}) {
  return {
    id: uid('q'),
    type: 'question',
    x: pos.x,
    y: pos.y,
    question: '',
    answers: [
      { id: uid('a'), text: '', correct: true, target: null },
      { id: uid('a'), text: '', correct: false, target: null },
    ],
    ...extra,
  }
}

export function addNode(course, type, pos, extra) {
  const node = type === 'video' ? newVideoNode(pos, extra) : newQuestionNode(pos, extra)
  course.nodes.push(node)
  if (!course.startId) course.startId = node.id
  return node
}

/** Position for a new node placed under `source` (spreads out when there are siblings). */
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
  // nudge right while overlapping an existing node
  for (let guard = 0; guard < 20; guard++) {
    const hit = course.nodes.some((n) => Math.abs(n.x - pos.x) < 200 && Math.abs(n.y - pos.y) < 140)
    if (!hit) break
    pos = { x: pos.x + 250, y: pos.y }
  }
  return pos
}

export function connect(course, sourceId, handle, targetId) {
  const src = findNode(course, sourceId)
  if (!src || !findNode(course, targetId)) return false
  if (src.type === 'video') {
    if (targetId === sourceId) return false
    src.next = targetId
    return true
  }
  const a = src.answers.find((x) => 'a-' + x.id === handle)
  if (!a) return false
  a.target = targetId
  return true
}

export function disconnect(course, sourceId, handle) {
  const src = findNode(course, sourceId)
  if (!src) return
  if (src.type === 'video') src.next = null
  else {
    const a = src.answers.find((x) => 'a-' + x.id === handle)
    if (a) a.target = null
  }
}

/** Create a node and link it from (sourceId, handle) in one go.
 *  If that handle already pointed somewhere, the new node is inserted in between. */
export function addLinkedNode(course, sourceId, handle, type, pos) {
  const src = findNode(course, sourceId)
  const previous = src
    ? src.type === 'video'
      ? src.next
      : src.answers.find((a) => 'a-' + a.id === handle)?.target
    : null
  const node = addNode(course, type, pos ?? positionBelow(course, src, handle))
  if (src) connect(course, sourceId, handle, node.id)
  if (previous) {
    if (node.type === 'video') node.next = previous
    else node.answers[0].target = previous
  }
  return node
}

export function deleteNode(course, id) {
  course.nodes = course.nodes.filter((n) => n.id !== id)
  for (const n of course.nodes) {
    if (n.type === 'video' && n.next === id) n.next = null
    if (n.type === 'question') n.answers.forEach((a) => a.target === id && (a.target = null))
  }
  if (course.startId === id) course.startId = orderedNodes(course)[0]?.id ?? course.nodes[0]?.id ?? null
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

/** Tidy the canvas with dagre (top → bottom, like the storyboard). */
export function autoLayout(course, dims = {}) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 64, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of course.nodes) {
    const d = dims[n.id] ?? { width: NODE_W[n.type], height: n.type === 'video' ? 180 : 80 + n.answers.length * 30 }
    g.setNode(n.id, d)
  }
  for (const n of course.nodes) for (const o of outgoing(n)) if (o.target !== n.id) g.setEdge(n.id, o.target)
  dagre.layout(g)
  for (const n of course.nodes) {
    const p = g.node(n.id)
    n.x = Math.round(p.x - p.width / 2)
    n.y = Math.round(p.y - p.height / 2)
  }
}

/** The parts of a course that matter to the headset (positions excluded). */
export function contentSnapshot(course) {
  return JSON.stringify({
    name: course.name,
    description: course.description,
    startId: course.startId,
    nodes: course.nodes.map(({ x, y, ...rest }) => rest),
  })
}

export function courseStatus(course) {
  if (!course.published) return { key: 'draft', label: 'Concept' }
  if (course.publishedSnapshot !== contentSnapshot(course)) return { key: 'changed', label: 'Gepubliceerd, niet alle wijzigingen' }
  return { key: 'live', label: 'Gepubliceerd' }
}

export function usedVideoIds(course) {
  return new Set(course.nodes.filter((n) => n.type === 'video' && n.videoId).map((n) => n.videoId))
}
