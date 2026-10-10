const canvas = document.getElementById('gameCanvas')
const c = canvas.getContext('2d')

function resizeCanvas() {
  const wrapper = document.getElementById('game-wrapper')
  // Vertical game: cap width to 720px for a comfortable playing field; fill full height
  canvas.width = Math.min(window.innerWidth, 720)
  canvas.height = window.innerHeight
  if (wrapper) {
    wrapper.style.width = canvas.width + 'px'
    wrapper.style.height = canvas.height + 'px'
  }
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

const GRAVITY = 0.28
const JUMP_FORCE = -10
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
let bestPlatforms = 0  // tracked in-memory; persisted on the server
let spawnY = 0
let frameCount = 0

let attackTimer = 0
const ATTACK_DUR = 28
const ATTACK_RANGE = 150
let attackCycle = 0
let attackPressed = false

let score = 0
let playerHitCooldown = 0
const HIT_COOLDOWN = 90  // ~1.5s invincibility after being hit

const player = {
  x: 0, y: 0,
  w: 25, h: 34,
  vx: 0, vy: 0,
  onGround: false,
  facingRight: true,
  dead: false,
  hp: 2,
  maxHp: 2,
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

  // --- Draw HP bar above player ---
  if (!player.dead) {
    const barW = 32
    const barH = 5
    const barX = player.x + player.w / 2 - barW / 2
    const barY = screenY - 14
    // Background
    c.fillStyle = 'rgba(0,0,0,0.55)'
    c.beginPath()
    c.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3)
    c.fill()
    // HP fill
    const hpRatio = player.hp / player.maxHp
    const hpColor = hpRatio > 0.5 ? '#00ff88' : '#ff4060'
    c.fillStyle = hpColor
    c.shadowColor = hpColor
    c.shadowBlur = 6
    c.beginPath()
    c.roundRect(barX, barY, barW * hpRatio, barH, 2)
    c.fill()
    c.shadowBlur = 0
    // Invincibility blink — flash bar border when invincible
    if (playerHitCooldown > 0 && Math.floor(playerHitCooldown / 5) % 2 === 0) {
      c.strokeStyle = '#ffffff'
      c.lineWidth = 1
      c.beginPath()
      c.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3)
      c.stroke()
    }
  }

  if (!sp || !sp.image.complete || !sp.image.naturalWidth) {
    // Draw invincibility tint when hit
    c.globalAlpha = (playerHitCooldown > 0 && Math.floor(playerHitCooldown / 5) % 2 === 0) ? 0.4 : 1
    c.fillStyle = '#ffb700ff'
    c.fillRect(player.x, screenY, player.w, player.h)
    c.globalAlpha = 1
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

  const scale = 1.26
  const fw = sp.image.width / sp.frameRate
  const fh = sp.image.height
  const dw = fw * scale
  const dh = fh * scale
  const sx = player.x - (dw - player.w) / 2
  const sy = screenY - (dh - player.h)

  // Blink player sprite when invincible
  if (playerHitCooldown > 0 && Math.floor(playerHitCooldown / 5) % 2 === 0) {
    c.globalAlpha = 0.35
  }
  c.drawImage(sp.image, sp.currentFrame * fw, 0, fw, fh, sx, sy, dw, dh)
  c.globalAlpha = 1
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
  // Use a fixed minimum edge margin for ALL platform types to prevent
  // any platform from touching or bleeding into the left/right boundary voids.
  const edgeMargin = 48
  const minW = canvas.width * 0.10
  const maxW = canvas.width * 0.22
  const w = minW + Math.random() * (maxW - minW)
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
    const newPlat = createPlatform(spawnY)
    platforms.push(newPlat)
    // If a danger platform spawned, always add a safe companion platform
    // positioned directly beside it so the player has a way to pass.
    if (newPlat.type === 'danger') {
      const safePlatW = canvas.width * 0.14
      // Try to place the safe platform to the right first; fall back to left
      let safeX = newPlat.x + newPlat.w + 20
      if (safeX + safePlatW > canvas.width - 48) {
        safeX = newPlat.x - safePlatW - 20
      }
      safeX = Math.max(48, Math.min(canvas.width - safePlatW - 48, safeX))
      platforms.push({
        x: safeX,
        y: spawnY,
        w: safePlatW,
        h: PLAT_H,
        type: 'normal',
        broken: false, crackTimer: 0, cracking: false,
        dir: 1, speed: 0,
        counted: false,
        glowPhase: Math.random() * Math.PI * 2,
      })
    }
    spawnY -= platformGap()
  }
}

function cullPlatforms() {
  platforms = platforms.filter(p => p.y < cameraY + canvas.height + CULL_BELOW)
}

function getClimbedHeight() {
  const startY = canvas.height * 0.75
  return Math.max(0, Math.round((startY - highestReached) / 8))
}

function createCreature(worldY) {
  const fromLeft = Math.random() < 0.5
  const cw = 46, ch = 46
  const spawnX = fromLeft ? -cw : canvas.width
  return {
    x: spawnX,
    y: worldY,
    w: cw, h: ch,
    vx: (fromLeft ? 1 : -1) * (0.4 + Math.random() * 0.3),
    animPhase: Math.random() * Math.PI * 2,
    alive: true,
    hp: 1,
    hitFlash: 0,
  }
}

function spawnCreatureIfNeeded() {
  const height = getClimbedHeight()
  // Spawn creatures at halved rate (every 240 frames ~4s, max 2 active creatures)
  if (frameCount % 240 === 0 && creatures.length < 2) {
    const worldY = cameraY + canvas.height * 0.15 + Math.random() * (canvas.height * 0.45)
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

  // Huge attack range box covering both sides and surrounding vertical space
  const hbX = player.facingRight
    ? player.x - 30
    : player.x - ATTACK_RANGE
  const hbY = player.y - 40
  const hbW = ATTACK_RANGE + 60
  const hbH = player.h + 80

  for (const cr of creatures) {
    if (!cr.alive) continue
    if (
      hbX < cr.x + cr.w &&
      hbX + hbW > cr.x &&
      hbY < cr.y + cr.h &&
      hbY + hbH > cr.y
    ) {
      cr.hp = 0
      cr.alive = false
      score += 30
      spawnParticles(cr.x + cr.w / 2, cr.y + cr.h / 2, '#ff4060', 16)
      spawnParticles(cr.x + cr.w / 2, cr.y + cr.h / 2, '#ffcc00', 8)
      spawnScorePopup(cr.x + cr.w / 2, cr.y - cameraY - 10, '+30')
    }
  }

  const tipX = player.facingRight ? player.x + player.w + 10 : player.x - 10
  spawnParticles(tipX, player.y + player.h * 0.4, '#ffffffcc', 5)
}

let scorePopups = []

function spawnScorePopup(x, y, text) {
  scorePopups.push({ x, y, text, life: 1.0, vy: -1.2 })
}

function updateAndDrawScorePopups() {
  scorePopups = scorePopups.filter(p => p.life > 0)
  for (const p of scorePopups) {
    p.y += p.vy
    p.life -= 0.018
    const alpha = Math.min(1, p.life * 2)
    c.save()
    c.globalAlpha = alpha
    c.font = 'bold 15px Orbitron, monospace'
    c.textAlign = 'center'
    c.fillStyle = '#ffe566'
    c.shadowColor = '#ffcc00'
    c.shadowBlur = 10
    c.fillText(p.text, p.x, p.y)
    c.restore()
  }
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
const hudScore = document.getElementById('hud-score')

function updateHUD() {
  const height = getClimbedHeight()
  hudPlatforms.textContent = platformCount
  hudHeight.textContent = height + 'm'
  hudBest.textContent = bestPlatforms
  if (hudScore) hudScore.textContent = score
  if (window.__audioManager) {
    window.__audioManager.updateHeight(height)
  }
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
        if (platformCount > bestPlatforms) bestPlatforms = platformCount
      }

      if (p.type === 'glass' && !p.cracking) {
        p.cracking = true
        p.crackTimer = 55
        spawnParticles(p.x + p.w / 2, p.y, 'rgba(255, 198, 160, 0.9)', 5)
      }
      if (p.type === 'danger') { killPlayer(); return }
    }
  }

  if (playerHitCooldown > 0) playerHitCooldown--

  if (attackTimer <= 0) {
    for (const cr of creatures) {
      if (!cr.alive) continue
      const overlap = (
        player.x < cr.x + cr.w - 4 &&
        player.x + player.w > cr.x + 4 &&
        player.y < cr.y + cr.h - 4 &&
        player.y + player.h > cr.y + 4
      )
      if (overlap && playerHitCooldown <= 0) {
        player.hp--
        playerHitCooldown = HIT_COOLDOWN
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4060', 10)
        if (player.hp <= 0) { killPlayer(); return }
      }
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
    if (cr.x < 0 && cr.vx < 0) {
      cr.x = 0
      cr.vx = Math.abs(cr.vx)
    } else if (cr.x + cr.w > canvas.width && cr.vx > 0) {
      cr.x = canvas.width - cr.w
      cr.vx = -Math.abs(cr.vx)
    }
    if (cr.hitFlash > 0) cr.hitFlash--
  }
  creatures = creatures.filter(cr => cr.alive && cr.y < cameraY + canvas.height + CULL_BELOW && cr.y > cameraY - 400)
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
  if (sy < -80 || sy > canvas.height + 80) return

  cr.animPhase += 0.07
  c.save()

  const cx = cr.x + cr.w / 2
  const isFlash = cr.hitFlash > 0
  const walkBob = Math.sin(cr.animPhase * 1.4) * 2
  const tiltAngle = cr.vx > 0 ? 0.12 : -0.12

  // Translate to centre for tilt
  c.translate(cx, sy + cr.h / 2)
  c.rotate(tiltAngle)

  const skinColor = isFlash ? '#ffffff' : '#4a8c3a'
  const darkSkin  = isFlash ? '#cccccc' : '#2e5c24'
  const rottColor = isFlash ? '#dddddd' : '#6daa56'
  const glowCol   = isFlash ? '#ffffff' : '#22ff44'

  if (!isFlash) {
    c.shadowColor = '#22ff44'
    c.shadowBlur = 12
  } else {
    c.shadowColor = '#ffffff'
    c.shadowBlur = 20
  }

  // --- BODY (torso) ---
  c.fillStyle = skinColor
  c.beginPath()
  c.roundRect(-9, -8 + walkBob, 18, 18, [3])
  c.fill()
  // tattered shirt lines
  if (!isFlash) {
    c.strokeStyle = darkSkin
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(-4, -4 + walkBob); c.lineTo(-4, 8 + walkBob)
    c.moveTo(2, -4 + walkBob);  c.lineTo(2, 8 + walkBob)
    c.stroke()
  }

  // --- HEAD ---
  c.fillStyle = skinColor
  c.shadowBlur = isFlash ? 20 : 8
  c.beginPath()
  // Slightly asymmetric (deformed) head
  c.ellipse(1, -18 + walkBob, 9, 10, 0.15, 0, Math.PI * 2)
  c.fill()
  // skull rot patch
  if (!isFlash) {
    c.fillStyle = darkSkin
    c.beginPath()
    c.ellipse(-3, -21 + walkBob, 3, 2.5, 0.3, 0, Math.PI * 2)
    c.fill()
  }

  c.shadowBlur = 0

  // --- EYES ---
  const eyeOffX = cr.vx > 0 ? 1 : -1
  // Left eye – red glowing
  c.fillStyle = isFlash ? '#fff' : '#ff0000'
  c.beginPath()
  c.ellipse(-3 + eyeOffX, -19 + walkBob, 2.5, 2, 0, 0, Math.PI * 2)
  c.fill()
  // Right eye – hollow / missing
  c.fillStyle = isFlash ? '#fff' : '#111'
  c.beginPath()
  c.ellipse(5 + eyeOffX, -18 + walkBob, 2, 2, 0, 0, Math.PI * 2)
  c.fill()
  if (!isFlash) {
    c.fillStyle = '#ff4400'
    c.beginPath()
    c.arc(5 + eyeOffX, -18 + walkBob, 0.8, 0, Math.PI * 2)
    c.fill()
  }

  // --- MOUTH (jagged grin) ---
  if (!isFlash) {
    c.strokeStyle = '#111'
    c.lineWidth = 1.2
    c.beginPath()
    c.moveTo(-5 + eyeOffX, -12 + walkBob)
    for (let t = 0; t <= 4; t++) {
      const mx = -5 + eyeOffX + t * 2.5
      const my = -12 + walkBob + (t % 2 === 0 ? 0 : 2.5)
      c.lineTo(mx, my)
    }
    c.stroke()
  }

  // --- ARMS (dangling) ---
  c.strokeStyle = skinColor
  c.lineWidth = 4
  c.lineCap = 'round'
  // left arm – dragging forward
  const lArmSwing = Math.sin(cr.animPhase) * 6
  c.beginPath()
  c.moveTo(-9, -4 + walkBob)
  c.quadraticCurveTo(-18, 4, -14 + lArmSwing, 14 + walkBob)
  c.stroke()
  // right arm – reaching out zombie-style
  const rArmReach = cr.vx > 0 ? 14 : -14
  const rArmSwing = Math.sin(cr.animPhase + 1) * 4
  c.beginPath()
  c.moveTo(9, -4 + walkBob)
  c.quadraticCurveTo(18, 0, rArmReach + rArmSwing, -2 + walkBob)
  c.stroke()

  // --- LEGS (stumbling walk) ---
  c.strokeStyle = darkSkin
  c.lineWidth = 5
  const legL = Math.sin(cr.animPhase) * 7
  const legR = Math.sin(cr.animPhase + Math.PI) * 7
  // left leg
  c.beginPath()
  c.moveTo(-5, 10 + walkBob)
  c.lineTo(-5 + legL, 24)
  c.stroke()
  // right leg
  c.beginPath()
  c.moveTo(5, 10 + walkBob)
  c.lineTo(5 + legR, 24)
  c.stroke()

  // --- Dripping gore detail ---
  if (!isFlash) {
    c.fillStyle = '#1a6e0e'
    for (let i = 0; i < 3; i++) {
      const drip = Math.sin(cr.animPhase * 0.5 + i * 1.3) * 2
      c.beginPath()
      c.ellipse(-6 + i * 5, 10 + walkBob + drip, 1.5, 2.5 + drip * 0.5, 0, 0, Math.PI * 2)
      c.fill()
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
  const height = getClimbedHeight()
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
  const height = getClimbedHeight()
  if (window.__audioManager) {
    window.__audioManager.pauseAll()
  }

  // Notify React to submit score to the leaderboard
  if (typeof window.__onGameOver === 'function') {
    window.__onGameOver(height, platformCount)
  }

  overlay.innerHTML = `
    <h1 style="font-size:30px;letter-spacing:3px;color:#ff4060;
      text-shadow:0 0 20px rgba(255,60,80,0.7);margin-bottom:10px;">GAME OVER</h1>
    <div style="font-family:Inter,sans-serif;color:rgba(255,255,255,0.55);
      font-size:14px;text-align:center;line-height:2.2;margin-bottom:18px;">
      Zombie kills score: <span style="color:#ffe566;font-weight:700">${score} pts</span><br>
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
  if (window.__audioManager) {
    window.__audioManager.playTrack(1)
  }
  overlay.style.display = 'none'
  platformCount = 0
  score = 0
  cameraY = 0
  frameCount = 0
  attackTimer = 0
  attackCycle = 0
  playerHitCooldown = 0
  milestoneMsg = ''
  milestoneTimer = 0
  creatures = []
  particles = []
  scorePopups = []
  player.x = canvas.width / 2 - player.w / 2
  player.y = canvas.height * 0.75
  highestReached = player.y
  player.vx = 0
  player.vy = 0
  player.dead = false
  player.hp = player.maxHp
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
  updateAndDrawScorePopups()
  drawMilestoneBanner()
}

initStars()
player.x = canvas.width / 2 - player.w / 2
player.y = canvas.height * 0.75
highestReached = player.y
spawnInitialPlatforms()
hudBest.textContent = bestPlatforms
gameLoop()