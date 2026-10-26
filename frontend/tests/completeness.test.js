import { describe, expect, it } from 'vitest'
import { checkCourse } from '../src/lib/completeness'

// The live completeness check (specs/005 FR-010 – FR-017, SC-003, SC-004, data-model.md § Melding).

let n = 0
const video = (extra = {}) => ({ id: `v${++n}`, type: 'video', x: 0, y: 0, videoId: 17, next: null, ...extra })
const question = (targets = [null, null], extra = {}) => ({
  id: `q${++n}`,
  type: 'question',
  x: 0,
  y: 0,
  question: 'Wat doe je?',
  feedback: '',
  answers: targets.map((target, i) => ({ id: `a${++n}`, text: `Antwoord ${i + 1}`, correct: i === 0, target })),
  ...extra,
})
const course = (nodes, startId = nodes[0]?.id ?? null) => ({ id: 1, name: 'R', description: 'D', startId, nodes })
const codes = (c, videos = { 17: { available: true } }) => checkCourse(c, videos).issues.map((i) => i.code)

/** A valid route: start question, A → video 1, B → video 2. */
function validRoute() {
  const v1 = video()
  const v2 = video()
  const q = question([v1.id, v2.id])
  return course([q, v1, v2])
}

describe('a complete course', () => {
  it('has no messages and is complete', () => {
    const result = checkCourse(validRoute(), { 17: { available: true } })
    expect(result.issues).toEqual([])
    expect(result.complete).toBe(true)
  })

  it('allows a loop with an exit (wrong answer shows the video again)', () => {
    const v1 = video()
    const end = video()
    const q = question([end.id, v1.id])
    v1.next = q.id
    expect(codes(course([v1, q, end]))).toEqual([])
  })

  it('treats a question without any next step as an end (FR-005)', () => {
    expect(codes(course([question()]))).toEqual([])
  })
})

describe('each rule gives exactly its message (SC-003)', () => {
  it('empty course: only "Voeg een onderdeel toe" (FR-016)', () => {
    const { issues } = checkCourse(course([]))
    expect(issues).toEqual([{ id: 'empty', code: 'empty', msg: 'Voeg een onderdeel toe', nodeId: null, answerId: null }])
  })

  it('no start: "Kies een startonderdeel", without reachability messages (FR-010)', () => {
    const c = validRoute()
    c.startId = null
    expect(codes(c)).toEqual(['noStart'])
    expect(checkCourse(c).issues[0].msg).toBe('Kies een startonderdeel')
  })

  it('unreachable step (FR-012)', () => {
    const c = validRoute()
    const loose = video()
    c.nodes.push(loose)
    const { issues } = checkCourse(c, { 17: { available: true } })
    expect(issues).toEqual([{ id: `unreachable:${loose.id}`, code: 'unreachable', msg: 'Niet bereikbaar vanaf de start', nodeId: loose.id, answerId: null }])
  })

  it('open answer while another answer continues (FR-013)', () => {
    const v1 = video()
    const q = question([v1.id, null])
    const { issues } = checkCourse(course([q, v1]), { 17: { available: true } })
    const answerB = q.answers[1].id
    expect(issues).toEqual([
      { id: `answerOpen:${q.id}:${answerB}`, code: 'answerOpen', msg: 'Antwoord B is nog niet verbonden', nodeId: q.id, answerId: answerB },
    ])
  })

  it('no reachable end, and steps that never end (FR-011, FR-014)', () => {
    const v1 = video()
    const v2 = video({ next: v1.id })
    v1.next = v2.id
    const result = checkCourse(course([v1, v2]), { 17: { available: true } })
    expect(result.issues.map((i) => [i.code, i.nodeId])).toEqual([
      ['noEnd', null],
      ['neverEnds', v1.id],
      ['neverEnds', v2.id],
    ])
    expect(result.issues[0].msg).toBe('De route heeft geen einde')
    expect(result.issues[1].msg).toBe('Vanaf hier eindigt de route nooit')
  })

  it('a loop without exit next to a reachable end only reports the loop (FR-014)', () => {
    const end = video()
    const loopA = video()
    const loopB = video({ next: loopA.id })
    loopA.next = loopB.id
    const q = question([end.id, loopA.id])
    expect(codes(course([q, end, loopA, loopB]))).toEqual(['neverEnds', 'neverEnds'])
  })

  it('video without a video and a video that is no longer available (FR-015)', () => {
    const c = course([video({ videoId: null })])
    expect(checkCourse(c).issues.map((i) => i.msg)).toEqual(['Kies een video'])
    const gone = course([video({ videoId: 9 })])
    expect(checkCourse(gone, { 9: { available: false } }).issues.map((i) => i.msg)).toEqual([
      'Kies een andere video: deze is niet meer beschikbaar',
    ])
  })

  it('empty question and empty answer (FR-015)', () => {
    const q = question([null, null], { question: '  ' })
    q.answers[0].text = ''
    const msgs = checkCourse(course([q])).issues.map((i) => i.msg)
    expect(msgs).toEqual(['Vul de vraag in', 'Antwoord A is leeg'])
  })

  it('the example of a new course only asks for two videos (FR-028)', () => {
    const v1 = video({ videoId: null })
    const v2 = video({ videoId: null })
    const q = question([v1.id, v2.id])
    expect(codes(course([q, v1, v2]))).toEqual(['noVideo', 'noVideo'])
  })
})

describe('stable ids and grouping', () => {
  it('gives every issue an id of code, step and answer, and groups them per step', () => {
    const v1 = video({ videoId: null })
    const q = question([v1.id, null])
    const result = checkCourse(course([q, v1]))
    expect(result.issues.map((i) => i.id)).toEqual([`answerOpen:${q.id}:${q.answers[1].id}`, `noVideo:${v1.id}`])
    expect(Object.keys(result.byNode)).toEqual([q.id, v1.id])
  })
})

describe('performance (SC-004)', () => {
  it('checks 50 branching steps well within 200 ms', () => {
    const nodes = []
    for (let i = 0; i < 25; i++) {
      const v = video()
      const q = question([null, null, null])
      nodes.push(q, v)
    }
    // Every question: A → its video, B → next question, C → back to the first question.
    for (let i = 0; i < nodes.length; i += 2) {
      const q = nodes[i]
      q.answers[0].target = nodes[i + 1].id
      q.answers[1].target = nodes[i + 2]?.id ?? nodes[i + 1].id
      q.answers[2].target = nodes[0].id
    }
    const c = course(nodes)
    const start = performance.now()
    for (let run = 0; run < 10; run++) checkCourse(c, { 17: { available: true } })
    const perRun = (performance.now() - start) / 10
    expect(perRun).toBeLessThan(200)
  })
})
