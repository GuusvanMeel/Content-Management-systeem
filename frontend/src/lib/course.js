// Pure helpers for a course draft in the editor (specs/004 research R9).
//
// Data model (see lib/courseMapping.js for the conversion from and to the API)
//   course        = { id, name, description, startId, nodes: [...] }
//   video node    = { id, type: 'video', x, y, videoId }                       videoId: null = no video yet
//   question node = { id, type: 'question', x, y, question, feedback, answers: [{ id, text, correct }] }
// Order and branching between steps (FR-08) are not part of this feature: there are no links.
import { uid, LETTERS } from './util'

export const NODE_W = { video: 220, question: 240 }
const NODE_H = { video: 180, questionBase: 80, perAnswer: 30 }
const GAP = 60

export function findNode(course, id) {
  return course.nodes.find((n) => n.id === id)
}

/** The start step first, then top to bottom and left to right on the canvas (research R9). */
export function orderedNodes(course) {
  return [...course.nodes].sort((a, b) => {
    if (a.id === course.startId) return -1
    if (b.id === course.startId) return 1
    return a.y - b.y || a.x - b.x
  })
}

/** The name of a step: its video or its question (FR-017a). */
export function nodeLabel(node, stepVideos = {}) {
  if (!node) return ''
  if (node.type === 'video') return (node.videoId && stepVideos[node.videoId]?.name) || 'Kies een video'
  return node.question || 'Nieuwe vraag'
}

export function newVideoNode(pos = { x: 0, y: 0 }) {
  return { id: uid('n'), type: 'video', x: pos.x, y: pos.y, videoId: null }
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
      { id: uid('a'), text: '', correct: true },
      { id: uid('a'), text: '', correct: false },
    ],
  }
}

/** Adds a step; the first step of an empty course becomes the start step (FR-018). */
export function addNode(course, type, pos) {
  const node = type === 'video' ? newVideoNode(pos) : newQuestionNode(pos)
  if (!course.nodes.length) course.startId = node.id
  course.nodes.push(node)
  return node
}

/** Removes a step; without it the course has no start step until another one is chosen. */
export function deleteNode(course, id) {
  course.nodes = course.nodes.filter((n) => n.id !== id)
  if (course.startId === id) course.startId = null
}

export function addAnswer(node) {
  if (node.answers.length >= 4) return
  node.answers.push({ id: uid('a'), text: '', correct: false })
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

/** "Canvas ordenen": the blocks in list order, in one column (research R9). */
export function autoLayout(course) {
  let y = 0
  for (const n of orderedNodes(course)) {
    n.x = Math.round((NODE_W.question - NODE_W[n.type]) / 2)
    n.y = y
    y += nodeHeight(n) + GAP
  }
}
