// Course check. Every issue blocks publishing (FR-07: only complete courses can be published).
import { findNode, outgoing, isEnd } from './course'
import { LETTERS } from './util'

export function validateCourse(course, videosById = {}) {
  const issues = []
  const add = (msg, nodeId = null, field = null) => issues.push({ msg, nodeId, field })

  if (!course.name?.trim()) add('Naam van de cursus ontbreekt', null, 'name')
  if (!course.description?.trim()) add('Beschrijving van de cursus ontbreekt', null, 'description')

  const start = course.startId && findNode(course, course.startId)
  if (!start) add('Geen startpunt gekozen')

  for (const n of course.nodes) {
    if (n.type === 'video') {
      if (!n.videoId || !videosById[n.videoId]) add('Kies een video', n.id, 'video')
    } else {
      if (!n.question?.trim()) add('Vraag is leeg', n.id, 'question')
      if (n.answers.filter((a) => a.correct).length !== 1) add('Kies het goede antwoord', n.id, 'correct')
      n.answers.forEach((a, i) => {
        if (!a.text?.trim()) add(`Antwoord ${LETTERS[i]} is leeg`, n.id, 'answer:' + a.id)
        if (!a.target) add(`Antwoord ${LETTERS[i]} is niet gekoppeld`, n.id, 'target:' + a.id)
      })
    }
  }

  // Every part a learner can reach must lead to an end (no endless loops).
  if (start) {
    const reach = new Set()
    const stack = [start.id]
    while (stack.length) {
      const id = stack.pop()
      const n = findNode(course, id)
      if (!n || reach.has(id)) continue
      reach.add(id)
      outgoing(n).forEach((o) => stack.push(o.target))
    }
    const canEnd = new Set(course.nodes.filter(isEnd).map((n) => n.id))
    if (![...canEnd].some((id) => reach.has(id))) add('De route heeft geen einde')
    else {
      let changed = true
      while (changed) {
        changed = false
        for (const n of course.nodes)
          if (!canEnd.has(n.id) && outgoing(n).some((o) => canEnd.has(o.target))) {
            canEnd.add(n.id)
            changed = true
          }
      }
      for (const id of reach) if (!canEnd.has(id)) add('Vanaf hier eindigt de route nooit', id)
    }
  }

  const byNode = {}
  for (const i of issues) if (i.nodeId) (byNode[i.nodeId] ??= []).push(i)
  return { issues, byNode, canPublish: issues.length === 0 }
}
