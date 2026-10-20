// Procedural equirectangular "360° frames" so the prototype has something
// to show without real video files. Each demo video has a `scene` description.
import { mulberry32 } from './util'

const thumbCache = new Map()

export function drawPanorama(ctx, W, H, scene = {}) {
  const rnd = mulberry32(scene.seed ?? 7)
  const kind = scene.kind ?? 'hall'
  const horizon = H * 0.52
  const wallTop = H * 0.3

  // ceiling / sky
  let g = ctx.createLinearGradient(0, 0, 0, wallTop)
  g.addColorStop(0, scene.top ?? '#d9e2ea')
  g.addColorStop(1, scene.mid ?? '#eef2f5')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, wallTop + 1)

  // walls
  g = ctx.createLinearGradient(0, wallTop, 0, horizon)
  g.addColorStop(0, scene.wall ?? '#e6e9ec')
  g.addColorStop(1, shade(scene.wall ?? '#e6e9ec', -0.12))
  ctx.fillStyle = g
  ctx.fillRect(0, wallTop, W, horizon - wallTop)

  // floor
  g = ctx.createLinearGradient(0, horizon, 0, H)
  g.addColorStop(0, scene.floor ?? '#9aa3ab')
  g.addColorStop(1, shade(scene.floor ?? '#9aa3ab', -0.35))
  ctx.fillStyle = g
  ctx.fillRect(0, horizon, W, H - horizon)

  if (kind === 'outdoor') {
    g = ctx.createLinearGradient(0, 0, 0, horizon)
    g.addColorStop(0, '#6aa6d8')
    g.addColorStop(1, '#cfe3f1')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, horizon)
    ctx.fillStyle = 'rgba(255,255,255,.85)'
    for (let i = 0; i < 9; i++) {
      const x = rnd() * W, y = rnd() * H * 0.25 + H * 0.05
      for (let j = 0; j < 4; j++) ellipse(ctx, x + j * W * 0.02, y + (j % 2) * 4, W * 0.03, H * 0.018)
    }
    for (let i = 0; i < 14; i++) {
      const w = W * (0.04 + rnd() * 0.05), h = H * (0.08 + rnd() * 0.14), x = rnd() * W
      ctx.fillStyle = shade(scene.wall ?? '#8d8f92', -rnd() * 0.3)
      ctx.fillRect(x, horizon - h, w, h)
      ctx.fillStyle = 'rgba(255,240,200,.55)'
      for (let wy = horizon - h + 6; wy < horizon - 8; wy += 10)
        for (let wx = x + 5; wx < x + w - 6; wx += 9) ctx.fillRect(wx, wy, 4, 5)
    }
  }

  if (kind === 'pool') {
    // tile grid on the walls
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    ctx.lineWidth = Math.max(1, W / 1024)
    for (let x = 0; x < W; x += W / 96) line(ctx, x, wallTop, x, horizon)
    for (let y = wallTop; y < horizon; y += H / 60) line(ctx, 0, y, W, y)
    // windows
    ctx.fillStyle = 'rgba(210,235,255,.9)'
    for (let i = 0; i < 6; i++) {
      const x = W * (0.05 + i * 0.16)
      ctx.fillRect(x, wallTop + H * 0.02, W * 0.1, H * 0.08)
    }
    // pool water
    const px0 = W * 0.18, px1 = W * 0.82
    g = ctx.createLinearGradient(0, horizon + H * 0.03, 0, H)
    g.addColorStop(0, '#5fc4e0')
    g.addColorStop(1, '#0b6d93')
    ctx.fillStyle = g
    ctx.fillRect(px0, horizon + H * 0.04, px1 - px0, H)
    // lane ropes
    for (let i = 1; i < 6; i++) {
      const lx = px0 + ((px1 - px0) / 6) * i
      ctx.strokeStyle = i % 2 ? '#e0483e' : '#f1c232'
      ctx.lineWidth = Math.max(2, W / 400)
      ctx.beginPath()
      ctx.moveTo(lx, horizon + H * 0.04)
      ctx.quadraticCurveTo(lx + (lx - W / 2) * 0.4, H * 0.8, lx + (lx - W / 2) * 0.9, H)
      ctx.stroke()
    }
    // ripples
    ctx.strokeStyle = 'rgba(255,255,255,.25)'
    ctx.lineWidth = 1
    for (let i = 0; i < 70; i++) {
      const x = px0 + rnd() * (px1 - px0), y = horizon + H * 0.06 + rnd() * H * 0.4
      ctx.beginPath()
      ctx.arc(x, y, W * 0.006, 0.2, Math.PI - 0.2)
      ctx.stroke()
    }
  }

  if (kind === 'hall' || kind === 'office') {
    for (let i = 0; i < 8; i++) {
      const x = W * (0.03 + i * 0.125)
      ctx.fillStyle = kind === 'office' ? 'rgba(180,215,240,.9)' : shade(scene.accent ?? '#5b6b7a', -0.1)
      const h = kind === 'office' ? H * 0.1 : horizon - wallTop - H * 0.02
      const y = kind === 'office' ? wallTop + H * 0.03 : wallTop + H * 0.02
      ctx.fillRect(x, y, W * 0.05, h)
    }
    // ceiling lights
    ctx.fillStyle = 'rgba(255,255,240,.95)'
    for (let i = 0; i < 10; i++) ellipse(ctx, W * (0.05 + i * 0.1), H * 0.12, W * 0.018, H * 0.012)
    // floor lines
    ctx.strokeStyle = 'rgba(0,0,0,.12)'
    for (let i = 0; i < 24; i++) line(ctx, (W / 24) * i, horizon, (W / 24) * i + (i - 12) * 20, H)
  }

  if (kind === 'fire') {
    ctx.fillStyle = 'rgba(0,0,0,.35)'
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 5; i++) {
      const x = W * (0.1 + rnd() * 0.8), y = horizon - H * 0.02
      const r = W * (0.04 + rnd() * 0.05)
      const fg = ctx.createRadialGradient(x, y, 2, x, y, r)
      fg.addColorStop(0, 'rgba(255,220,120,.95)')
      fg.addColorStop(0.4, 'rgba(255,120,30,.7)')
      fg.addColorStop(1, 'rgba(120,20,0,0)')
      ctx.fillStyle = fg
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.fillStyle = 'rgba(70,70,75,.35)'
    for (let i = 0; i < 60; i++) ellipse(ctx, rnd() * W, rnd() * H * 0.3, W * 0.05, H * 0.04)
  }

  // scene-specific props (e.g. the bottle on the floor)
  for (const p of scene.props ?? []) {
    ctx.fillStyle = p.color
    ctx.fillRect(W * p.x, H * p.y, W * (p.w ?? 0.008), H * (p.h ?? 0.03))
  }
  // a figure, if the scene has one
  for (const f of scene.figures ?? []) {
    const x = W * f.x, y = horizon + H * 0.04, s = H * (f.s ?? 0.16)
    ctx.fillStyle = f.color ?? '#c8102e'
    ctx.fillRect(x - s * 0.13, y - s * 0.75, s * 0.26, s * 0.55)
    ctx.fillStyle = '#e7b98f'
    ellipse(ctx, x, y - s * 0.86, s * 0.11, s * 0.12)
    ctx.fillStyle = '#2b2f36'
    ctx.fillRect(x - s * 0.12, y - s * 0.22, s * 0.1, s * 0.3)
    ctx.fillRect(x + s * 0.02, y - s * 0.22, s * 0.1, s * 0.3)
  }

  // tinted overlay for variety
  if (scene.tint) {
    ctx.fillStyle = scene.tint
    ctx.fillRect(0, 0, W, H)
  }
}

export function panoramaCanvas(scene, W = 2048) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = W / 2
  drawPanorama(c.getContext('2d'), c.width, c.height, scene)
  return c
}

/** Thumbnail data URL for a video (uploaded thumb wins over the procedural one). */
export function videoThumb(video) {
  if (!video) return ''
  if (video.thumb) return video.thumb
  const key = video.id + JSON.stringify(video.scene ?? {})
  if (!thumbCache.has(key)) {
    const c = panoramaCanvas(video.scene ?? { seed: 3 }, 512)
    thumbCache.set(key, c.toDataURL('image/jpeg', 0.8))
  }
  return thumbCache.get(key)
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
}
function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}
function shade(hex, amt) {
  const n = hex.replace('#', '')
  const f = (i) => {
    const v = parseInt(n.slice(i, i + 2), 16)
    const t = amt < 0 ? 0 : 255
    return Math.round(v + (t - v) * Math.abs(amt))
  }
  return `rgb(${f(0)},${f(2)},${f(4)})`
}
