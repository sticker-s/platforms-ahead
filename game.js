const canvas = document.getElementById('gameCanvas')
const c = canvas.getContext('2d')

function resizeCanvas() {
  canvas.width = Math.min(window.innerWidth, 820)
  canvas.height = Math.min(window.innerHeight, 960)
  const wrapper = document.getElementById('game-wrapper')
  if (wrapper) {
    wrapper.style.width = canvas.width + 'px'
    wrapper.style.height = canvas.height + 'px'
  }
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

const GRAVITY = 0.28
const JUMP_FORCE = -9.5
const PLAYER_SPD = 3.2
const PLAT_H = 14
const SPAWN_ABOVE = 220
const CULL_BELOW = 300

let gameState = 'idle'
let platforms = []
let creatures = []
let particles = []
let stars = []
let cameraY = 0
let highestReached = 0
let platformCount = 0
let bestPlatforms = parseInt(localStorage.getItem('pa_best') || '0')
let spawnY = 0
let frameCount = 0

let attackTimer = 0
const ATTACK_DUR = 28
const ATTACK_RANGE = 70
let attackCycle = 0
let attackPressed = false

const player = {
  x: 0, y: 0,
  w: 32, h: 42,
  vx: 0, vy: 0,
  onGround: false,
  facingRight: true,
  dead: false,
  sprites: {},
}

const SPRITE_META = {
  Idle: { fr: 8, fb: 9 },
  IdleLeft: { fr: 8, fb: 9 },
  Run: { fr: 8, fb: 10 },
  RunLeft: { fr: 8, fb: 10 },
  Jump: { fr: 2, fb: 9 },
  JumpLeft: { fr: 2, fb: 9 },
  Fall: { fr: 2, fb: 9 },
  FallLeft: { fr: 2, fb: 9 },
  Attack1: { fr: 4, fb: 7 },
  Attack2: { fr: 3, fb: 7 },
  Attack3: { fr: 4, fb: 7 },
  Death: { fr: 6, fb: 9 },
}

Object.entries(SPRITE_META).forEach(([key, meta]) => {
  const img = new Image()
  img.src = `./img/warrior/${key}.png`
  player.sprites[key] = { image: img, frameRate: meta.fr, frameBuffer: meta.fb, currentFrame: 0, elapsed: 0 }
})

let currentKey = 'Idle'

function switchSprite(key) {
  if (!player.sprites[key] || currentKey === key) return
  currentKey = key
  player.sprites[key].currentFrame = 0
  player.sprites[key].elapsed = 0
}

function drawPlayer() {
  const sp = player.sprites[currentKey]
  const screenY = player.y - cameraY

  if (!sp || !sp.image.complete || !sp.image.naturalWidth) {
    c.fillStyle = '#ffb700ff'
    c.fillRect(player.x, screenY, player.w, player.h)
    return
  }

  sp.elapsed++
  if (sp.elapsed % sp.frameBuffer === 0) {
    if (currentKey.startsWith('Attack')) {
      if (sp.currentFrame >= sp.frameRate - 1) {
        attackTimer = 0
        sp.currentFrame = 0
      } else {
        sp.currentFrame++
      }
    } else {
      sp.currentFrame = (sp.currentFrame + 1) % sp.frameRate
    }
  }

  const scale = 1
  const fw = sp.image.width / sp.frameRate
  const fh = sp.image.height
  const dw = fw * scale
  const dh = fh * scale
  const sx = player.x - (dw - player.w) / 2
  const sy = screenY - (dh - player.h)

  c.drawImage(sp.image, sp.currentFrame * fw, 0, fw, fh, sx, sy, dw, dh)
}

function fillRoundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

function createPlatform(worldY, forceType) {
  const rand = Math.random()
  const depth = Math.abs(worldY) / 500
  let type = forceType || 'normal'
  if (!forceType) {
    if (depth > 1.2 && rand < 0.12) type = 'danger'
    else if (depth > 0.6 && rand < 0.22) type = 'glass'
    else if (depth > 0.3 && rand < 0.20) type = 'moving'
  }
  const minW = canvas.width * 0.14
  const maxW = canvas.width * 0.28
  const w = minW + Math.random() * (maxW - minW)
  const edgeMargin = type === 'danger' ? canvas.width * 0.22 : 24
  const maxX = canvas.width - w - edgeMargin
  const platX = edgeMargin + Math.random() * Math.max(0, maxX - edgeMargin)
  return {
    x: platX,
    y: worldY, w, h: PLAT_H, type,
    broken: false, crackTimer: 0, cracking: false,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: 0.6 + Math.random() * 0.9,
    counted: false,
    glowPhase: Math.random() * Math.PI * 2,
  }
}

function spawnInitialPlatforms() {
  platforms = []
  platforms.push({
    x: canvas.width / 2 - 60, y: player.y + player.h + 5,
    w: 120, h: PLAT_H, type: 'normal',
    broken: false, crackTimer: 0, cracking: false,
    dir: 1, speed: 0, counted: false, glowPhase: 0,
  })
  spawnY = player.y - 110
  for (let i = 0; i < 18; i++) {
    platforms.push(createPlatform(spawnY, i < 5 ? 'normal' : undefined))
    spawnY -= platformGap()
  }
}

const PLATFORM_STEP = 130

function platformGap() {
  return PLATFORM_STEP
}

function spawnMorePlatforms() {
  while (spawnY > cameraY - SPAWN_ABOVE) {
    platforms.push(createPlatform(spawnY))
    spawnY -= platformGap()
  }
}

function cullPlatforms() {
  platforms = platforms.filter(p => p.y < cameraY + canvas.height + CULL_BELOW)
}

function createCreature(worldY) {
  const fromLeft = Math.random() < 0.5
  const cw = 34, ch = 34
  return {
    x: fromLeft ? -cw : canvas.width,
    y: worldY,
    w: cw, h: ch,
    vx: (fromLeft ? 1 : -1) * (0.5 + Math.random() * 0.8),
    animPhase: Math.random() * Math.PI * 2,
    alive: true,
    hp: 2,
    hitFlash: 0,
  }
}

function spawnCreatureIfNeeded() {
  const currentHeight = Math.max(0, Math.round(Math.abs(highestReached) / 8))
  // Lowered threshold from 100m to 10m, and reduced frame interval from 380 to 220 for quicker spawns
  if (currentHeight >= 10 && frameCount % 220 === 0) {
    const worldY = cameraY + 60 + Math.random() * (canvas.height * 0.55)
    creatures.push(createCreature(worldY))
  }
}

function doAttack() {
  if (attackTimer > 0) return
  attackTimer = ATTACK_DUR
  attackCycle = (attackCycle + 1) % 3
  const keyName = `Attack${attackCycle + 1}`
  player.sprites[keyName].currentFrame = 0
  player.sprites[keyName].elapsed = 0
  switchSprite(keyName)

  const hbX = player.facingRight
    ? player.x + player.w
    : player.x - ATTACK_RANGE
  const hbY = player.y + player.h * 0.1
  const hbW = ATTACK_RANGE
  const hbH = player.h * 0.8

  for (const cr of creatures) {
    if (!cr.alive) continue
    if (
      hbX < cr.x + cr.w &&
      hbX + hbW > cr.x &&
      hbY < cr.y + cr.h &&
      hbY + hbH > cr.y
    ) {
      cr.hp--
      cr.hitFlash = 12
      if (cr.hp <= 0) {
        cr.alive = false
        spawnParticles(cr.x + cr.w / 2, cr.y + cr.h / 2, '#ff6060', 14)
        spawnParticles(cr.x + cr.w / 2, cr.y + cr.h / 2, '#ffcc00', 6)
      } else {
        spawnParticles(cr.x + cr.w / 2, cr.y + cr.h / 2, '#ff9900', 5)
      }
    }
  }

  const tipX = player.facingRight ? player.x + player.w + 10 : player.x - 10
  spawnParticles(tipX, player.y + player.h * 0.4, '#ffffffcc', 5)
}

function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 1 * i) / count + Math.random() * 0.1
    particles.push({
      x, y,
      vx: Math.cos(angle) * (1 + Math.random() * 0.2),
      vy: Math.sin(angle) * (1 + Math.random() * 0.2) - 1,
      life: 1, decay: 0.025 + Math.random() * 0.03,
      r: 3 + Math.random() * 1,
      color,
      pixel: false,
    })
  }
}

function spawnLandingPixels(x, y, color) {
  const cols = ['#00e5ff', '#7b2fff', '#ffffff', '#00b4cc', '#b388ff']
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const speed = 1.2 + Math.random() * 1.0
    particles.push({
      x: x + (Math.random() - 0.5) * 2,
      y: y + Math.random() * 1,
      vx: side * speed,
      vy: -(0.2 + Math.random() * 1.2),
      life: 1, decay: 0.04 + Math.random() * 0.03,
      r: 2 + Math.floor(Math.random() * 3),
      color: cols[Math.floor(Math.random() * cols.length)],
      pixel: true,
    })
  }
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 14,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: -(1.5 + Math.random() * 3),
      life: 1, decay: 0.055 + Math.random() * 0.03,
      r: 2,
      color: '#ffffff',
      pixel: true,
    })
  }
}

function spawnDoubleJumpPuff(x, y) {
  const cols = ['#9b59b6', '#d7bde2', '#ffffff', '#7b2fff']
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10
    particles.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y + player.h / 2,
      vx: Math.cos(angle) * (0.5 + Math.random() * 2),
      vy: Math.sin(angle) * (0.5 + Math.random() * 2),
      life: 1, decay: 0.05 + Math.random() * 0.03,
      r: 2 + Math.floor(Math.random() * 3),
      color: cols[Math.floor(Math.random() * cols.length)],
      pixel: true,
    })
  }
}

function initStars() {
  stars = []
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 8,
      r: Math.random() * 1.8,
      opacity: 0.15 + Math.random() * 0.55,
      twinkle: Math.random() * Math.PI * 2,
    })
  }
}

function updateCamera() {
  const screenY = player.y - cameraY
  const threshold = canvas.height * 0.38
  if (screenY < threshold) {
    cameraY = player.y - threshold
  }
}

const hudPlatforms = document.getElementById('hud-platforms')
const hudHeight = document.getElementById('hud-height')
const hudBest = document.getElementById('hud-best')

function updateHUD() {
  const height = Math.max(0, Math.round(Math.abs(highestReached) / 8))
  hudPlatforms.textContent = platformCount
  hudHeight.textContent = height + 'm'
  hudBest.textContent = bestPlatforms
}

const keys = { left: false, right: false, jump: false, attack: false }

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
  if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = true
  if (e.key === 'd' || e.key === 'ArrowRight') keys.right = true
  if ((e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') && !keys.jump) {
    keys.jump = true
  }
  if (e.key === 'e' && !attackPressed) {
    attackPressed = true
    if (gameState === 'playing' && !player.dead) doAttack()
  }
})
window.addEventListener('keyup', e => {
  if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = false
  if (e.key === 'd' || e.key === 'ArrowRight') keys.right = false
  if (e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') keys.jump = false
  if (e.key === 'e') attackPressed = false
})

let jumpKeyHeld = false
let jumpQueued = false
let canDoubleJump = false

window.addEventListener('keydown', e => {
  if (e.key !== 'w' && e.key !== 'ArrowUp' && e.key !== ' ') return
  if (e.key === ' ') e.preventDefault()
  if (jumpKeyHeld) return
  jumpKeyHeld = true

  if (gameState !== 'playing' || player.dead) return

  if (player.onGround) {
    jumpQueued = true
  } else if (canDoubleJump) {
    canDoubleJump = false
    player.vy = JUMP_FORCE * 0.88
    spawnDoubleJumpPuff(player.x + player.w / 2, player.y)
  }
})
window.addEventListener('keyup', e => {
  if (e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') jumpKeyHeld = false
})

function updatePlayer() {
  if (player.dead) return

  player.vx = 0
  if (keys.left) { player.vx = -PLAYER_SPD; player.facingRight = false }
  if (keys.right) { player.vx = PLAYER_SPD; player.facingRight = true }

  player.x += player.vx
  if (player.x + player.w < 0) player.x = canvas.width
  if (player.x > canvas.width) player.x = -player.w

  player.vy += GRAVITY
  player.y += player.vy

  if (jumpQueued && player.onGround) {
    player.vy = JUMP_FORCE
    player.onGround = false
    canDoubleJump = true
    jumpQueued = false
  }

  player.onGround = false

  for (const p of platforms) {
    if (p.broken) continue
    const prevBottom = player.y - player.vy + player.h
    const currBottom = player.y + player.h

    if (
      currBottom >= p.y &&
      prevBottom <= p.y + p.h + 2 &&
      player.x + player.w > p.x + 2 &&
      player.x < p.x + p.w - 2 &&
      player.vy >= 0
    ) {
      player.vy = 0
      player.y = p.y - player.h

      if (!player.onGround) {
        canDoubleJump = true
        spawnLandingPixels(player.x + player.w / 2, p.y, '#00e5ff')
      }
      player.onGround = true

      if (!p.counted) {
        p.counted = true
        platformCount++
        if (platformCount > bestPlatforms) {
          bestPlatforms = platformCount
          localStorage.setItem('pa_best', bestPlatforms)
        }
      }

      if (p.type === 'glass' && !p.cracking) {
        p.cracking = true
        p.crackTimer = 55
        spawnParticles(p.x + p.w / 2, p.y, 'rgba(255, 198, 160, 0.9)', 5)
      }
      if (p.type === 'danger') { killPlayer(); return }
    }
  }

  if (attackTimer <= 0) {
    for (const cr of creatures) {
      if (!cr.alive) continue
      const overlap = (
        player.x < cr.x + cr.w - 4 &&
        player.x + player.w > cr.x + 4 &&
        player.y < cr.y + cr.h - 4 &&
        player.y + player.h > cr.y + 4
      )
      if (overlap) { killPlayer(); return }
    }
  }

  if (player.y < highestReached) highestReached = player.y

  if (player.y > cameraY + canvas.height + 100) {
    killPlayer()
    return
  }

  if (attackTimer > 0) {
  } else if (!player.onGround) {
    switchSprite(player.vy < 0
      ? (player.facingRight ? 'Jump' : 'JumpLeft')
      : (player.facingRight ? 'Fall' : 'FallLeft'))
  } else {
    switchSprite(player.vx !== 0
      ? (player.facingRight ? 'Run' : 'RunLeft')
      : (player.facingRight ? 'Idle' : 'IdleLeft'))
  }

  if (attackTimer > 0) attackTimer--
}

function killPlayer() {
  if (player.dead) return
  player.dead = true
  switchSprite('Death')
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4060', 18)
  setTimeout(showGameOver, 1100)
}

function updatePlatforms() {
  for (const p of platforms) {
    if (p.type === 'moving') {
      p.x += p.dir * p.speed
      if (p.x < 0 || p.x + p.w > canvas.width) p.dir *= -1
    }
    if (p.cracking && !p.broken) {
      p.crackTimer--
      if (p.crackTimer <= 0) {
        p.broken = true
        spawnParticles(p.x + p.w / 2, p.y, 'rgba(255, 187, 160, 0.9)', 12)
      }
    }
  }
}

function updateCreatures() {
  for (const cr of creatures) {
    if (!cr.alive) continue
    cr.x += cr.vx
    if (cr.x < 0 || cr.x + cr.w > canvas.width) cr.vx *= -1
    if (cr.hitFlash > 0) cr.hitFlash--
  }
  creatures = creatures.filter(cr => cr.alive && cr.y < cameraY + canvas.height + CULL_BELOW)
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.06
    p.life -= p.decay
  }
  particles = particles.filter(p => p.life > 0)
}

function drawBackground() {
  frameCount++
  const depth = Math.min(1, Math.abs(cameraY) / 4000)
  const topB = Math.round(28 + depth * 60)
  const grad = c.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0, `rgb(${Math.round(8 + depth * 18)},${Math.round(4 + depth * 4)},${topB})`)
  grad.addColorStop(1, `rgb(${Math.round(14 + depth * 28)},${Math.round(6 + depth * 8)},${Math.round(topB * 0.55)})`)
  c.fillStyle = grad
  c.fillRect(0, 0, canvas.width, canvas.height)

  for (const s of stars) {
    const sy = ((s.y - cameraY * 0.12) % (canvas.height * 2) + canvas.height * 2) % (canvas.height * 2)
    s.twinkle += 0.035
    const alpha = s.opacity * (0.6 + 0.4 * Math.sin(s.twinkle))
    c.beginPath()
    c.arc(s.x, sy, s.r, 0, Math.PI * 2)
    c.fillStyle = `rgba(255,255,255,${alpha})`
    c.fill()
  }

  if (depth > 0.2) {
    c.globalAlpha = depth * 0.04
    c.fillStyle = '#aaddff'
    for (let i = 0; i < 5; i++) {
      const fy = ((frameCount * 0.3 + i * 160) % canvas.height)
      c.fillRect(0, fy, canvas.width, 40)
    }
    c.globalAlpha = 1
  }
}

function drawPlatform(p) {
  const sy = p.y - cameraY
  if (sy > canvas.height + 20 || sy + p.h < -20) return
  if (p.broken) return

  c.save()
  const glow = 0.5 + 0.5 * Math.sin(p.glowPhase + frameCount * 0.04)

  if (p.type === 'normal') {
    const gr = c.createLinearGradient(p.x, sy, p.x, sy + p.h)
    gr.addColorStop(0, '#5dce9e')
    gr.addColorStop(1, '#2e8060')
    c.fillStyle = gr
    fillRoundRect(p.x, sy, p.w, p.h, 5)
    c.fill()
    c.fillStyle = 'rgba(255,255,255,0.22)'
    c.fillRect(p.x + 5, sy + 2, p.w - 10, 3)

  } else if (p.type === 'glass') {
    const flashRate = p.cracking ? 0.45 : 0
    const alpha = p.cracking ? 0.3 + 0.35 * Math.sin(frameCount * flashRate) : 0.5
    c.fillStyle = `rgba(140,220,255,${alpha})`
    fillRoundRect(p.x, sy, p.w, p.h, 5)
    c.fill()
    c.strokeStyle = `rgba(210,245,255,${alpha + 0.25})`
    c.lineWidth = 1.5
    fillRoundRect(p.x, sy, p.w, p.h, 5)
    c.stroke()
    if (p.cracking) {
      c.strokeStyle = 'rgba(255,255,255,0.55)'
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(p.x + p.w * 0.3, sy)
      c.lineTo(p.x + p.w * 0.55, sy + p.h)
      c.moveTo(p.x + p.w * 0.65, sy)
      c.lineTo(p.x + p.w * 0.42, sy + p.h)
      c.stroke()
    }

  } else if (p.type === 'moving') {
    const gr = c.createLinearGradient(p.x, sy, p.x, sy + p.h)
    gr.addColorStop(0, '#f0933a')
    gr.addColorStop(1, '#a85420')
    c.fillStyle = gr
    fillRoundRect(p.x, sy, p.w, p.h, 5)
    c.fill()
    c.fillStyle = 'rgba(255,255,255,0.35)'
    c.font = '11px sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(p.dir > 0 ? '▶ ▶' : '◀ ◀', p.x + p.w / 2, sy + p.h / 2)

  } else if (p.type === 'danger') {
    const gr = c.createLinearGradient(p.x, sy, p.x, sy + p.h)
    gr.addColorStop(0, '#d63031')
    gr.addColorStop(1, '#7b1010')
    c.fillStyle = gr
    fillRoundRect(p.x, sy, p.w, p.h, 3)
    c.fill()
    c.fillStyle = '#ff5555'
    const spikes = Math.floor(p.w / 14)
    for (let i = 0; i < spikes; i++) {
      const sx = p.x + 5 + i * 14
      c.beginPath()
      c.moveTo(sx, sy)
      c.lineTo(sx + 6, sy - 8)
      c.lineTo(sx + 12, sy)
      c.closePath()
      c.fill()
    }
    c.shadowColor = '#ff2222'
    c.shadowBlur = 10 * glow
    c.strokeStyle = 'rgba(255,50,50,0.5)'
    c.lineWidth = 1
    fillRoundRect(p.x, sy, p.w, p.h, 3)
    c.stroke()
    c.shadowBlur = 0
  }

  c.restore()
}

function drawCreature(cr) {
  if (!cr.alive) return
  const sy = cr.y - cameraY
  if (sy < -60 || sy > canvas.height + 60) return

  cr.animPhase += 0.07
  c.save()

  const pulse = 0.88 + 0.12 * Math.sin(cr.animPhase)
  const rx = (cr.w / 2) * pulse
  const ry = (cr.h / 2) * pulse

  if (cr.hitFlash > 0) {
    c.fillStyle = `rgba(255,255,255,${cr.hitFlash / 12})`
    c.shadowColor = '#ffffff'
    c.shadowBlur = 16
  } else {
    c.fillStyle = '#c0392b'
    c.shadowColor = '#ff0000'
    c.shadowBlur = 12
  }

  c.beginPath()
  c.ellipse(cr.x + cr.w / 2, sy + cr.h / 2, rx, ry, 0, 0, Math.PI * 2)
  c.fill()
  c.shadowBlur = 0

  if (cr.hitFlash <= 0) {
    const eyeDir = cr.vx > 0 ? 6 : -6
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(cr.x + cr.w / 2 + eyeDir - 4, sy + 11, 3.5, 0, Math.PI * 2)
    c.arc(cr.x + cr.w / 2 + eyeDir + 4, sy + 11, 3.5, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#111'
    c.beginPath()
    c.arc(cr.x + cr.w / 2 + eyeDir - 4, sy + 11, 1.8, 0, Math.PI * 2)
    c.arc(cr.x + cr.w / 2 + eyeDir + 4, sy + 11, 1.8, 0, Math.PI * 2)
    c.fill()

    const barW = cr.w
    c.fillStyle = 'rgba(0,0,0,0.4)'
    c.fillRect(cr.x, sy - 10, barW, 4)
    c.fillStyle = cr.hp >= 2 ? '#2ecc71' : '#e74c3c'
    c.fillRect(cr.x, sy - 10, barW * (cr.hp / 2), 4)

    c.strokeStyle = '#922b21'
    c.lineWidth = 2.5
    for (let i = 0; i < 4; i++) {
      const lx = cr.x + 4 + i * 7
      const phase = cr.animPhase + i * 0.9
      c.beginPath()
      c.moveTo(lx, sy + cr.h - 4)
      c.lineTo(lx + Math.sin(phase) * 4, sy + cr.h + 7)
      c.stroke()
    }
  }

  c.restore()
}

function drawParticles() {
  for (const p of particles) {
    const sy = p.y - cameraY
    c.globalAlpha = p.life
    c.fillStyle = p.color
    if (p.pixel) {
      const size = Math.max(1, Math.round(p.r * p.life))
      c.fillRect(Math.round(p.x) - size, Math.round(sy) - size, size * 2, size * 2)
    } else {
      c.beginPath()
      c.arc(p.x, sy, Math.max(0.5, p.r * p.life), 0, Math.PI * 2)
      c.fill()
    }
  }
  c.globalAlpha = 1
}

let milestoneMsg = ''
let milestoneTimer = 0
const MILESTONES = new Set([5, 10, 20, 50, 100, 200, 500, 1000])

function checkMilestone() {
  const height = Math.max(0, Math.round(Math.abs(highestReached) / 8))
  if (MILESTONES.has(height)) {
    if (milestoneMsg !== `${height}m`) {
      milestoneMsg = `${height}m`
      milestoneTimer = 120
    }
  }
}

function drawMilestoneBanner() {
  if (milestoneTimer <= 0) return
  milestoneTimer--
  const alpha = Math.min(1, milestoneTimer / 30)
  c.save()
  c.globalAlpha = alpha
  c.font = 'bold 22px Orbitron, monospace'
  c.textAlign = 'center'
  c.fillStyle = '#ffe566'
  c.shadowColor = '#ffcc00'
  c.shadowBlur = 18
  c.fillText(`🏆 ${milestoneMsg} reached!`, canvas.width / 2, canvas.height * 0.3)
  c.restore()
}

function drawAttackArc() {
  if (attackTimer <= 0) return
  const progress = 1 - attackTimer / ATTACK_DUR
  const tipX = player.facingRight
    ? player.x + player.w + ATTACK_RANGE * progress
    : player.x - ATTACK_RANGE * progress
  const tipY = player.y - cameraY + player.h * 0.35
  const alpha = attackTimer / ATTACK_DUR

  c.save()
  c.globalAlpha = alpha * 0.5
  c.strokeStyle = '#ffffffaa'
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(player.x + player.w / 2, player.y - cameraY + player.h * 0.4)
  c.lineTo(tipX, tipY)
  c.stroke()

  const grd = c.createRadialGradient(tipX, tipY, 0, tipX, tipY, 14)
  grd.addColorStop(0, 'rgba(255,255,220,0.8)')
  grd.addColorStop(1, 'rgba(255,200,80,0)')
  c.globalAlpha = alpha
  c.fillStyle = grd
  c.beginPath()
  c.arc(tipX, tipY, 14, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

const overlay = document.getElementById('overlay')

function showGameOver() {
  const height = Math.max(0, Math.round(Math.abs(highestReached) / 8))
  overlay.innerHTML = `
    <h1 style="font-size:30px;letter-spacing:3px;color:#ff4060;
      text-shadow:0 0 20px rgba(255,60,80,0.7);margin-bottom:10px;">GAME OVER</h1>
    <div style="font-family:Inter,sans-serif;color:rgba(255,255,255,0.55);
      font-size:14px;text-align:center;line-height:2.2;margin-bottom:18px;">
      Platforms cleared: <span style="color:#fff;font-weight:700">${platformCount}</span><br>
      Height reached: <span style="color:#fff;font-weight:700">${height}m</span><br>
      Best ever: <span style="color:#00e5ff;font-weight:700">${bestPlatforms} platforms</span>
    </div>
    <button id="restart-btn"
      style="font-family:Orbitron,monospace;font-size:13px;font-weight:700;
      letter-spacing:3px;padding:13px 36px;border:none;border-radius:7px;
      cursor:pointer;background:linear-gradient(135deg,#00e5ff,#7b2fff);
      color:#fff;text-transform:uppercase;
      box-shadow:0 0 24px rgba(100,200,255,0.45);">
      TRY AGAIN
    </button>
  `
  overlay.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;position:absolute;inset:0;background:rgba(5,5,20,0.88);backdrop-filter:blur(8px);border-radius:4px;z-index:10;'
  document.getElementById('restart-btn').addEventListener('click', startGame)
  gameState = 'dead'
}

document.getElementById('start-btn').addEventListener('click', startGame)

function startGame() {
  overlay.style.display = 'none'
  platformCount = 0
  highestReached = 0
  cameraY = 0
  frameCount = 0
  attackTimer = 0
  attackCycle = 0
  milestoneMsg = ''
  milestoneTimer = 0
  creatures = []
  particles = []
  player.x = canvas.width / 2 - 16
  player.y = canvas.height * 0.75
  player.vx = 0
  player.vy = 0
  player.dead = false
  player.onGround = false
  currentKey = 'Idle'
  jumpQueued = false
  jumpKeyHeld = false
  canDoubleJump = false
  Object.values(player.sprites).forEach(s => { s.currentFrame = 0; s.elapsed = 0 })
  spawnInitialPlatforms()
  updateHUD()
  gameState = 'playing'
}

function gameLoop() {
  requestAnimationFrame(gameLoop)

  drawBackground()

  if (gameState !== 'playing') {
    for (const p of platforms) drawPlatform(p)
    for (const cr of creatures) drawCreature(cr)
    if (gameState === 'idle') drawPlayer()
    drawParticles()
    return
  }

  spawnMorePlatforms()
  cullPlatforms()
  spawnCreatureIfNeeded()

  updatePlayer()
  updatePlatforms()
  updateCreatures()
  updateParticles()
  updateCamera()
  checkMilestone()
  updateHUD()

  for (const p of platforms) drawPlatform(p)
  for (const cr of creatures) drawCreature(cr)
  drawParticles()
  drawAttackArc()
  if (!player.dead) drawPlayer()
  drawMilestoneBanner()
}

initStars()
player.x = canvas.width / 2 - 16
player.y = canvas.height * 0.75
spawnInitialPlatforms()
hudBest.textContent = bestPlatforms
gameLoop()