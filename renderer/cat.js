const CAT_W = 160
const CAT_H = 160
const CANVAS_H = 210  // extra headroom for speech bubble
const WALK_SPEED = 1.5

const TRANSITIONS = {
  walk:  [{ s: 'sit', w: 60 }, { s: 'loaf', w: 20 }, { s: 'walk', w: 20 }],
  sit:   [{ s: 'walk', w: 40 }, { s: 'sleep', w: 35 }, { s: 'loaf', w: 15 }, { s: 'sit', w: 10 }],
  sleep: [{ s: 'sit', w: 85 }, { s: 'sleep', w: 15 }],
  loaf:  [{ s: 'walk', w: 35 }, { s: 'sleep', w: 35 }, { s: 'sit', w: 30 }],
  peek:  [{ s: 'sit', w: 60 }, { s: 'walk', w: 40 }],
  box:   [{ s: 'sit', w: 50 }, { s: 'walk', w: 30 }, { s: 'sleep', w: 20 }],
}

const STATE_DURATION = {
  walk:  { min: 4000,  max: 12000 },
  sit:   { min: 5000,  max: 14000 },
  sleep: { min: 18000, max: 50000 },
  loaf:  { min: 8000,  max: 20000 },
  peek:  { min: 3000,  max: 7000  },
  box:   { min: 10000, max: 25000 },
}

const SPRITE_CONFIGS = {
  walk:     { src: '../assets/walk.png',  frames: 4, fps: 8 },
  approach: { src: '../assets/walk.png',  frames: 4, fps: 9 },
  sit:      { src: '../assets/sit.png',   frames: 1 },
  sleep:    { src: '../assets/sleep.png', frames: 2, frameDurations: [2000, 600] },
}

const STATIC_SRCS = {
  loaf: '../assets/cat-loaf.png',
  peek: '../assets/cat-peek.png',
  box:  '../assets/cat-box.png',
}

const TRANSITION_MS = 300

// Runtime state
let catX = 0, catY = 0
let screenW = 1920, screenH = 1080
let originX = 0, originY = 0   // virtual screen top-left (multi-monitor)
let dir = 1
let cursorX = -9999, cursorY = -9999
let approachTargetX = 0, approachTargetY = 0
let state = 'walk'
let stateUntil = 0
let lastX = -1, lastY = -1
let currentFrame = 0
let lastFrameMs = 0

let prevState = null
let transitionStart = 0
let transitionAlpha = 1

// ── Bubble ────────────────────────────────────────────────────────

const bubbleEl = document.getElementById('bubble')
let bubbleTimer = null

function showBubble(text, durationMs = 3000) {
  if (bubbleTimer) clearTimeout(bubbleTimer)
  bubbleEl.textContent = text
  bubbleEl.classList.add('show')
  bubbleTimer = setTimeout(() => {
    bubbleEl.classList.remove('show')
    bubbleTimer = null
  }, durationMs)
}

const IDLE_LINES = [
  '喵～', '摸鱼可不行哦', '今天加油！', '我看着你呢',
  '要专注哦～', '好好干喵！', '困了吗？', '别走神啦',
]

// Accessories
let equippedItems = []
let lastDrawnDH = 100   // height of last drawn sprite, for accessory anchoring
let starParticles = []

const sprites = {}
const staticImgs = {}

const canvas = document.getElementById('cat')
const ctx = canvas.getContext('2d')

// ── Hit detection & interaction ───────────────────────────────────

const CLICK_LINES = ['喵？！', '别碰我！', '哼～', '干嘛啦！', '喵！', '讨厌！', '（竖起毛）']
let lastIgnore = true

function isOverCat(x, y) {
  if (x < 0 || y < 0 || x >= CAT_W || y >= CANVAS_H) return false
  const px = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
  return px[3] > 30
}

window.addEventListener('mousemove', e => {
  const over = isOverCat(e.clientX, e.clientY)
  if (over !== !lastIgnore) {
    lastIgnore = !over
    window.cat.setMouseIgnore(!over)
  }
})

canvas.addEventListener('click', e => {
  const line = CLICK_LINES[Math.floor(Math.random() * CLICK_LINES.length)]
  showBubble(line, 2000)
})

function rand(min, max) { return min + Math.random() * (max - min) }

function nextState(current) {
  const options = TRANSITIONS[current] || [{ s: 'walk', w: 1 }]
  const total = options.reduce((sum, o) => sum + o.w, 0)
  let r = Math.random() * total
  for (const o of options) { r -= o.w; if (r <= 0) return o.s }
  return options[0].s
}

function setState(s) {
  if (s === state) return
  prevState = state
  transitionStart = performance.now()
  transitionAlpha = 0
  state = s
  currentFrame = 0
  lastFrameMs = 0
  const dur = STATE_DURATION[s] || { min: 4000, max: 10000 }
  stateUntil = Date.now() + rand(dur.min, dur.max)
  // 5% chance of idle chatter on state change
  if (s === 'sit' || s === 'sleep' || s === 'loaf') {
    if (Math.random() < 0.05) {
      setTimeout(() => showBubble(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)]), 800)
    }
  }
}

function loadSprite(src, frames) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const frameW = Math.floor(img.naturalWidth / frames)
      const oc = document.createElement('canvas')
      oc.width = img.naturalWidth
      oc.height = img.naturalHeight
      const oc2 = oc.getContext('2d')
      oc2.drawImage(img, 0, 0)
      const id = oc2.getImageData(0, 0, oc.width, oc.height)
      const d = id.data
      let minY = oc.height, maxY = 0

      for (let i = 0; i < d.length; i += 4) {
        const whiteness = Math.min(d[i], d[i + 1], d[i + 2])
        if (whiteness > 180) {
          d[i + 3] = Math.round(255 * Math.max(0, 1 - (whiteness - 180) / 75))
        }
        if (d[i + 3] > 20) {
          const y = Math.floor((i / 4) / oc.width)
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
      oc2.putImageData(id, 0, 0)

      let minX = frameW, maxX = 0
      for (let j = 0; j < d.length; j += 4) {
        if (d[j + 3] > 20) {
          const localX = (j / 4) % oc.width % frameW
          if (localX < minX) minX = localX
          if (localX > maxX) maxX = localX
        }
      }

      const pad = 8
      const cropMinY = Math.max(0, minY - pad)
      const cropH = Math.min(oc.height, maxY + pad) - cropMinY
      const cropMinX = Math.max(0, minX - pad)
      const cropW = Math.min(frameW, maxX + pad) - cropMinX

      resolve({ canvas: oc, frameW, crop: { minY: cropMinY, cropH, minX: cropMinX, cropW } })
    }
    img.src = src
  })
}

function drawSprite(spriteData, frame) {
  const { canvas: sc, frameW, crop } = spriteData
  const srcW = crop.cropW || frameW
  const scale = Math.min(CAT_W / srcW, CAT_H / crop.cropH)
  const dw = srcW * scale
  const dh = crop.cropH * scale
  lastDrawnDH = dh   // cache for accessory positioning
  ctx.drawImage(
    sc,
    frame * frameW + (crop.minX || 0), crop.minY, srcW, crop.cropH,
    (CAT_W - dw) / 2, CANVAS_H - dh, dw, dh
  )
}

function drawState(s, alpha, timestamp) {
  const cfg = SPRITE_CONFIGS[s]
  const spriteData = sprites[s]
  ctx.save()
  ctx.globalAlpha = alpha
  if (dir === -1) { ctx.translate(CAT_W, 0); ctx.scale(-1, 1) }
  if (cfg && spriteData) {
    drawSprite(spriteData, s === state ? currentFrame : 0)
  } else {
    const img = staticImgs[s]
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, CANVAS_H - CAT_H, CAT_W, CAT_H)
    }
  }
  ctx.restore()
}

// ── Accessories ───────────────────────────────────────────────────

function drawAccessories() {
  if (equippedItems.length === 0) return

  const headX = CAT_W / 2
  const spriteTop = CAT_H - lastDrawnDH
  const headY = spriteTop + lastDrawnDH * 0.13

  ctx.save()
  // Mirror with cat direction so accessories stay on the right side
  if (dir === -1) { ctx.translate(CAT_W, 0); ctx.scale(-1, 1) }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const item of equippedItems) {
    if (item === 'hat') {
      ctx.font = '22px serif'
      ctx.fillText('🎩', headX, headY - 14)
    } else if (item === 'crown') {
      ctx.font = '20px serif'
      ctx.fillText('👑', headX, headY - 12)
    } else if (item === 'bow') {
      ctx.font = '16px serif'
      ctx.fillText('🎀', headX + 22, headY + lastDrawnDH * 0.28)
    } else if (item === 'glasses') {
      ctx.font = '14px serif'
      ctx.fillText('🕶️', headX, headY + lastDrawnDH * 0.16)
    }
  }
  ctx.restore()
}

// ── Star particles ────────────────────────────────────────────────

function updateStarParticles() {
  if (!equippedItems.includes('stars')) {
    starParticles = []
    return
  }

  // Spawn
  if (Math.random() < 0.04) {
    starParticles.push({
      x: CAT_W / 2 + (Math.random() - 0.5) * 50,
      y: CAT_H - lastDrawnDH * (0.15 + Math.random() * 0.7),
      life: 1.0,
      decay: 0.014 + Math.random() * 0.008,
      vy: -0.5 - Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.4,
    })
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = starParticles.length - 1; i >= 0; i--) {
    const p = starParticles[i]
    p.x += p.vx
    p.y += p.vy
    p.life -= p.decay
    if (p.life <= 0) { starParticles.splice(i, 1); continue }
    ctx.save()
    ctx.globalAlpha = p.life * 0.9
    ctx.font = '11px serif'
    ctx.fillText('✨', p.x, p.y)
    ctx.restore()
  }
}

// ── Draw loop ─────────────────────────────────────────────────────

function draw(timestamp) {
  ctx.clearRect(0, 0, CAT_W, CANVAS_H)

  if (transitionAlpha < 1) {
    transitionAlpha = Math.min(1, (timestamp - transitionStart) / TRANSITION_MS)
  }

  const cfg = SPRITE_CONFIGS[state]
  if (cfg) {
    const duration = cfg.frameDurations ? cfg.frameDurations[currentFrame] : 1000 / cfg.fps
    if (timestamp - lastFrameMs > duration) {
      currentFrame = (currentFrame + 1) % cfg.frames
      lastFrameMs = timestamp
    }
  }

  if (prevState && transitionAlpha < 1) {
    drawState(prevState, 1 - transitionAlpha, timestamp)
  }
  drawState(state, transitionAlpha, timestamp)

  drawAccessories()
  updateStarParticles()
}

function tick(timestamp) {
  const now = Date.now()

  if (state === 'walk') {
    catX += WALK_SPEED * dir
    catY = screenH - CAT_H
    if (catX <= 0) { catX = 0; dir = 1 }
    if (catX >= screenW - CAT_W) { catX = screenW - CAT_W; dir = -1 }
    if (now > stateUntil) {
      const cursorLocalX = cursorX - originX
      const cursorScreenX = cursorLocalX - CAT_W / 2
      const inRange = cursorLocalX > 0 && cursorLocalX < screenW
      if (inRange && Math.random() < 0.35) {
        approachTargetX = Math.max(0, Math.min(screenW - CAT_W, cursorScreenX))
        setState('approach')
      } else {
        setState(nextState('walk'))
      }
    }
  } else if (state === 'approach') {
    const dx = approachTargetX - catX
    const dy = approachTargetY - catY
    const dist = Math.hypot(dx, dy)
    if (dist < 8) {
      catX = approachTargetX
      catY = approachTargetY
      setState('sit')
    } else {
      const spd = WALK_SPEED * 1.5
      catX += (dx / dist) * spd
      catY += (dy / dist) * spd
      dir = dx >= 0 ? 1 : -1
    }
  } else {
    if (now > stateUntil) {
      catY = screenH - CAT_H
      setState(nextState(state))
    }
  }

  draw(timestamp)

  const rx = Math.round(catX), ry = Math.round(catY)
  if (rx !== lastX || ry !== lastY) {
    window.cat.move({ x: rx + originX, y: ry + originY })
    lastX = rx; lastY = ry
  }

  requestAnimationFrame(tick)
}

async function init() {
  const size = await window.cat.getScreenSize()
  screenW = size.width
  screenH = size.height
  originX = size.originX || 0
  originY = size.originY || 0
  catX = Math.floor(screenW / 2 - CAT_W / 2)
  catY = screenH - CAT_H

  const loaded = {}
  for (const [s, cfg] of Object.entries(SPRITE_CONFIGS)) {
    if (!loaded[cfg.src]) loaded[cfg.src] = await loadSprite(cfg.src, cfg.frames)
    sprites[s] = loaded[cfg.src]
  }

  for (const [key, src] of Object.entries(STATIC_SRCS)) {
    const img = new Image()
    img.src = src
    staticImgs[key] = img
  }

  window.cat.onCursor((pos) => { cursorX = pos.x; cursorY = pos.y })

  window.cat.onComeHere((cursor) => {
    approachTargetX = Math.max(0, Math.min(screenW - CAT_W, cursor.x - originX - CAT_W / 2))
    approachTargetY = Math.max(0, Math.min(screenH - CAT_H, cursor.y - originY - CAT_H / 2))
    setState('approach')
    showBubble('喵！在干嘛呢～', 4000)
  })

  window.cat.onShowBubble((text) => showBubble(text, 3500))

  window.cat.onEquipItems((items) => { equippedItems = items })

  setState('walk')
  requestAnimationFrame(tick)
}

init()
