// Demo data. Everything is fictional and only lives in the browser.
import { autoLayout, contentSnapshot } from '../lib/course'

const svg = (s) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s)

const logos = {
  pool: svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0B6E99"/><path d="M8 38c6 0 6-5 12-5s6 5 12 5 6-5 12-5 6 5 12 5" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M8 50c6 0 6-5 12-5s6 5 12 5 6-5 12-5 6 5 12 5" stroke="#F2B33D" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="40" cy="18" r="6" fill="#fff"/></svg>`),
  fire: svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1F2A37"/><path d="M32 10c4 9 14 14 14 27a14 14 0 0 1-28 0c0-7 4-11 7-14 0 5 2 8 5 9-2-8 0-15 2-22z" fill="#B3261E"/><path d="M32 34c2 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10z" fill="#F7C548"/></svg>`),
}

// Yonder logos: picked up automatically when the files are in src/assets/.
const assetLogos = import.meta.glob('../assets/logo-yonder*.svg', { eager: true, query: '?url', import: 'default' })
const yonder = {
  logo: assetLogos['../assets/logo-yonder.svg'] ?? null,
  logoOnBrand: assetLogos['../assets/logo-yonder-white.svg'] ?? null,
}

export const DEFAULT_BRANDING = { primary: '#2C4A6E', secondary: '#9AA9BC', logo: null }

export function seed() {
  const now = Date.now()
  const day = 86400000

  const orgs = [
    { id: 'org_tgr', name: 'Yonder Sport en beweging', code: 'TGR-4821', members: 6, branding: { primary: '#847dff', secondary: '#fd6555', ...yonder } },
    { id: 'org_ban', name: 'Brandweer Academie Noord', code: 'BAN-1190', members: 14, branding: { primary: '#B3261E', secondary: '#1F2A37', logo: logos.fire } },
    { id: 'org_yon', name: 'Yonder Demo', code: 'YON-0001', members: 2, branding: null },
  ]

  const pool = (seed, extra = {}) => ({ kind: 'pool', seed, top: '#c9d8e2', mid: '#e8eff3', wall: '#dfe8ec', floor: '#c7b8a0', ...extra })
  const hall = (seed, extra = {}) => ({ kind: 'hall', seed, top: '#e3e6ea', mid: '#f1f3f5', wall: '#cfd6dc', floor: '#8b949c', accent: '#40607a', ...extra })
  const v = (id, orgId, name, duration, scene, extra = {}) => ({
    id, orgId, name, duration, scene, resolution: '5760 × 2880', format: 'MP4 · H.265', sizeMB: Math.round(duration * 4.6), uploadedAt: now - 12 * day, ...extra,
  })

  const videos = [
    v('vid_post', 'org_tgr', 'Lifeguard loopt naar de post', 42, hall(11, { figures: [{ x: 0.5, color: '#d32f2f' }] })),
    v('vid_check', 'org_tgr', 'Check portofoon en reddingsmiddelen', 75, hall(12, { kind: 'office', props: [{ x: 0.48, y: 0.56, w: 0.03, h: 0.05, color: '#e65100' }] })),
    v('vid_bottle', 'org_tgr', 'Zwemzaal: flesje op de grond', 38, pool(13, { props: [{ x: 0.505, y: 0.6, w: 0.006, h: 0.03, color: '#2e7d32' }] })),
    v('vid_knock', 'org_tgr', 'Passant stoot flesje om', 21, pool(14, { figures: [{ x: 0.47, color: '#3949ab' }], props: [{ x: 0.5, y: 0.62, w: 0.02, h: 0.008, color: '#2e7d32' }] })),
    v('vid_mop', 'org_tgr', 'Lifeguard ruimt de plas op', 55, pool(15, { figures: [{ x: 0.52, color: '#d32f2f' }] })),
    v('vid_bin', 'org_tgr', 'Flesje in de prullenbak', 30, pool(16, { props: [{ x: 0.55, y: 0.5, w: 0.02, h: 0.06, color: '#455a64' }] })),
    v('vid_corner', 'org_tgr', 'Naar de hoek van de zwemzaal', 47, pool(17, { tint: 'rgba(0,40,80,.08)' })),
    v('vid_deep', 'org_tgr', 'Overzicht diepe bad', 64, pool(18, { tint: 'rgba(0,30,90,.15)' })),
    v('vid_swimmer', 'org_tgr', 'Zwemmer in nood bij de duikplank', 33, pool(19, { figures: [{ x: 0.6, color: '#f9a825', s: 0.1 }] })),
    v('vid_rules', 'org_tgr', 'Instructie: gladde vloeren', 90, hall(20), { uploadedAt: now - 2 * day }),
    v('vid_bf_brief', 'org_ban', 'Briefing bij de tankautospuit', 58, { kind: 'outdoor', seed: 31, wall: '#7d8187', floor: '#55595e' }),
    v('vid_bf_check', 'org_ban', 'Ademluchtset controleren', 81, hall(32, { kind: 'office', wall: '#b9bec4' })),
    v('vid_bf_smoke', 'org_ban', 'Binnenaanval met rookontwikkeling', 46, { kind: 'fire', seed: 33, top: '#3a3a3e', mid: '#55555a', wall: '#4a4a4f', floor: '#2c2c30' }),
    v('vid_bf_fail', 'org_ban', 'Alarm: lage cilinderdruk', 25, { kind: 'fire', seed: 34, top: '#2a2a2e', mid: '#45454a', wall: '#3b3b40', floor: '#252528' }),
  ]

  // ── Course 1: the lifeguard storyboard from the research document ──
  const lifeguard = {
    id: 'c_lifeguard',
    orgId: 'org_tgr',
    name: 'Alert op gevaren in de zwemzaal',
    description: 'Een lifeguard begint zijn dienst en treft een flesje frisdrank op de vloer aan. Herkent hij het risico op tijd?',
    startId: 'n1',
    createdAt: now - 20 * day,
    updatedAt: now - 3 * day,
    nodes: [
      { id: 'n1', type: 'video', title: 'Naar de lifeguardpost', description: 'De lifeguard loopt naar de post aan de rand van het bad.', videoId: 'vid_post', next: 'n2' },
      { id: 'n2', type: 'video', title: 'Uitrusting controleren', description: 'Check portofoon, reddingsmiddelen en waterkwaliteit.', videoId: 'vid_check', next: 'n3' },
      { id: 'n3', type: 'video', title: 'Flesje op de grond', description: 'Op weg naar de zwemzaal ligt een flesje frisdrank op de vloer.', videoId: 'vid_bottle', next: 'q1' },
      {
        id: 'q1', type: 'question', question: 'Wat doe je met het flesje?',
        answers: [
          { id: 'a1', text: 'Ik raap het op en gooi het weg', correct: true, target: 'n5' },
          { id: 'a2', text: 'Ik loop door naar mijn post', correct: false, target: 'n4' },
        ],
      },
      { id: 'n4', type: 'video', title: 'Passant stoot flesje om', description: 'Een bezoeker loopt het flesje omver.', videoId: 'vid_knock', next: 'n6' },
      { id: 'n6', type: 'video', title: 'Vloer opruimen', description: 'De vloer ligt onder de frisdrank; de lifeguard ruimt op.', videoId: 'vid_mop', next: 'n8' },
      { id: 'n8', type: 'video', title: 'Naar de hoek (na opruimen)', description: 'De lifeguard loopt naar de hoek van de zwemzaal.', videoId: 'vid_corner', next: null },
      { id: 'n5', type: 'video', title: 'Flesje in de prullenbak', description: 'Pakt het flesje op, sluit het af en gooit het weg.', videoId: 'vid_bin', next: 'n7' },
      { id: 'n7', type: 'video', title: 'Naar de hoek', description: 'De lifeguard loopt naar de hoek van de zwemzaal.', videoId: 'vid_corner', next: null },
    ],
  }

  // ── Course 2: work in progress, with deliberate gaps ──
  const deepEnd = {
    id: 'c_deep',
    orgId: 'org_tgr',
    name: 'Toezicht bij het diepe bad',
    description: '',
    startId: 'd1',
    createdAt: now - 4 * day,
    updatedAt: now - 2 * 3600000,
    nodes: [
      { id: 'd1', type: 'video', title: 'Overzicht diepe bad', description: 'Je neemt plaats in de stoel bij het diepe bad.', videoId: 'vid_deep', next: 'dq1' },
      {
        id: 'dq1', type: 'question', question: 'Waar let je als eerste op?',
        answers: [
          { id: 'da1', text: 'De duikplank', correct: true, target: 'd2' },
          { id: 'da2', text: 'De klok', correct: false, target: 'd1' },
          { id: 'da3', text: '', correct: false, target: null },
        ],
      },
      { id: 'd2', type: 'video', title: 'Zwemmer in nood', description: '', videoId: 'vid_swimmer', next: 'dq2' },
      {
        id: 'dq2', type: 'question', question: 'Hoe reageer je?',
        answers: [
          { id: 'db1', text: 'Fluiten en het water in', correct: false, target: 'd3' },
          { id: 'db2', text: 'Collega oproepen via portofoon', correct: false, target: 'd3' },
        ],
      },
      { id: 'd3', type: 'video', title: 'Afloop', description: '', videoId: null, next: null },
    ],
  }

  // ── Course 3: other organisation ──
  const breathing = {
    id: 'c_breath',
    orgId: 'org_ban',
    name: 'Ademluchtcontrole voor binnenaanval',
    description: 'Controleer je ademluchtset voordat je een brandend pand betreedt.',
    startId: 'b1',
    createdAt: now - 40 * day,
    updatedAt: now - 9 * day,
    nodes: [
      { id: 'b1', type: 'video', title: 'Briefing', description: 'De bevelvoerder geeft de opdracht voor een binnenaanval.', videoId: 'vid_bf_brief', next: 'b2' },
      { id: 'b2', type: 'video', title: 'Set controleren', description: 'Controleer cilinderdruk en masker.', videoId: 'vid_bf_check', next: 'bq' },
      {
        id: 'bq', type: 'question', question: 'De manometer geeft 240 bar aan. Ga je naar binnen?',
        answers: [
          { id: 'ba1', text: 'Nee, ik meld me bij de bevelvoerder', correct: false, target: 'b4' },
          { id: 'ba2', text: 'Ja, de druk is voldoende', correct: true, target: 'b3' },
        ],
      },
      { id: 'b3', type: 'video', title: 'Binnenaanval', description: '', videoId: 'vid_bf_smoke', next: null },
      { id: 'b4', type: 'video', title: 'Onnodig oponthoud', description: 'Het team wacht; de brand breidt zich uit.', videoId: 'vid_bf_fail', next: null },
    ],
  }

  const courses = [lifeguard, deepEnd, breathing]
  for (const c of courses) {
    c.nodes.forEach((n) => ((n.x = 0), (n.y = 0)))
    autoLayout(c)
    c.published = false
    c.publishedVersion = 0
    c.publishedSnapshot = null
  }
  const publish = (c, version, at) => {
    c.published = true
    c.publishedVersion = version
    c.publishedSnapshot = contentSnapshot(c)
    c.publishedAt = at
  }
  publish(lifeguard, 2, now - 3 * day)
  publish(breathing, 1, now - 9 * day)

  return { orgs, videos, courses, currentOrgId: 'org_tgr', editorVariant: 'inspector' }
}
