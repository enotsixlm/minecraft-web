import { TILE, W, H } from './world.js'
import { CROPS } from './crops.js'

const TILE_PX = 32

const COLORS = {
  grassA: '#4f8f3e',
  grassB: '#458538',
  dirt: '#8b5a2b',
  tilled: '#6b4423',
  watered: '#4a3420',
  water: '#3a7ca5',
  waterDeep: '#2f6285',
  path: '#c4a574',
  house: '#8b4513',
  houseRoof: '#a63d2a',
  floor: '#d4b896',
  bed: '#6b8cae',
  treeTrunk: '#6b4423',
  treeLeaf: '#2f6b32',
  weed: '#6aa84f',
  shop: '#b8860b',
  fence: '#5c4033',
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.tile = TILE_PX
    this.shake = 0
    this.particles = []
    this.camX = 0
    this.camY = 0
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    this.canvas.width = Math.floor(w * dpr)
    this.canvas.height = Math.floor(h * dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.viewW = w
    this.viewH = h
  }

  burst(wx, wy, color, n = 8) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: wx * this.tile + this.tile / 2,
        y: wy * this.tile + this.tile / 2,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        life: 0.4 + Math.random() * 0.3,
        color,
      })
    }
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 4)
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 120 * dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  draw(world, player, timeOfDay) {
    const ctx = this.ctx
    const t = this.tile
    const w = this.viewW
    const h = this.viewH

    // camera follow
    this.camX = player.x * t - w / 2
    this.camY = player.y * t - h / 2
    this.camX = Math.max(0, Math.min(this.camX, W * t - w))
    this.camY = Math.max(0, Math.min(this.camY, H * t - h))
    if (W * t < w) this.camX = (W * t - w) / 2
    if (H * t < h) this.camY = (H * t - h) / 2

    const sx = this.shake ? (Math.random() - 0.5) * 4 * this.shake : 0
    const sy = this.shake ? (Math.random() - 0.5) * 4 * this.shake : 0

    // sky / ambient backdrop
    const sky = skyColor(timeOfDay)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // soft sun glow
    const g = ctx.createRadialGradient(w * 0.7, h * 0.15, 10, w * 0.7, h * 0.15, 220)
    g.addColorStop(0, `rgba(255, 220, 120, ${0.35 * dayFactor(timeOfDay)})`)
    g.addColorStop(1, 'rgba(255,220,120,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(-this.camX + sx, -this.camY + sy)

    // tiles
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        this.drawTile(ctx, x, y, world.get(x, y), t)
        const crop = world.getCrop(x, y)
        if (crop) this.drawCrop(ctx, x, y, crop, t)
      }
    }

    // player
    this.drawPlayer(ctx, player, t)

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
      ctx.globalAlpha = 1
    }

    // target highlight
    const tg = player.targetTile()
    ctx.strokeStyle = 'rgba(255,255,200,0.65)'
    ctx.lineWidth = 2
    ctx.strokeRect(tg.x * t + 2, tg.y * t + 2, t - 4, t - 4)

    ctx.restore()

    // night veil
    const night = nightFactor(timeOfDay)
    if (night > 0.05) {
      ctx.fillStyle = `rgba(10, 16, 40, ${night * 0.55})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  drawTile(ctx, x, y, type, t) {
    const px = x * t
    const py = y * t
    switch (type) {
      case TILE.GRASS: {
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.grassA : COLORS.grassB
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(px + 6, py + 8, 3, 3)
        break
      }
      case TILE.DIRT:
        ctx.fillStyle = COLORS.dirt
        ctx.fillRect(px, py, t, t)
        break
      case TILE.TILLED:
        ctx.fillStyle = COLORS.tilled
        ctx.fillRect(px, py, t, t)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        for (let i = 1; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo(px + 2, py + i * 7)
          ctx.lineTo(px + t - 2, py + i * 7)
          ctx.stroke()
        }
        break
      case TILE.WATERED:
        ctx.fillStyle = COLORS.watered
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = 'rgba(80,140,200,0.35)'
        ctx.fillRect(px + 2, py + 2, t - 4, t - 4)
        break
      case TILE.WATER: {
        ctx.fillStyle = COLORS.water
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = COLORS.waterDeep
        ctx.fillRect(px + 4, py + 8, t - 8, 6)
        ctx.fillStyle = 'rgba(200,240,255,0.25)'
        ctx.fillRect(px + 6, py + 5, 8, 3)
        break
      }
      case TILE.PATH:
        ctx.fillStyle = COLORS.path
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = 'rgba(0,0,0,0.08)'
        ctx.fillRect(px + 10, py + 12, 4, 4)
        break
      case TILE.HOUSE:
        ctx.fillStyle = COLORS.houseRoof
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = '#f0d9a0'
        ctx.fillRect(px + 4, py + 10, t - 8, 8)
        break
      case TILE.SHOP:
        ctx.fillStyle = COLORS.shop
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = '#fff4d6'
        ctx.fillRect(px + 6, py + 8, t - 12, 10)
        ctx.fillStyle = '#2b2118'
        ctx.font = '10px sans-serif'
        ctx.fillText('店', px + 11, py + 17)
        break
      case TILE.FLOOR:
        ctx.fillStyle = COLORS.floor
        ctx.fillRect(px, py, t, t)
        break
      case TILE.BED:
        ctx.fillStyle = COLORS.floor
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = COLORS.bed
        ctx.fillRect(px + 4, py + 6, t - 8, t - 10)
        ctx.fillStyle = '#fff'
        ctx.fillRect(px + 6, py + 8, 10, 6)
        break
      case TILE.TREE:
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.grassA : COLORS.grassB
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = COLORS.treeTrunk
        ctx.fillRect(px + 13, py + 16, 6, 12)
        ctx.fillStyle = COLORS.treeLeaf
        ctx.beginPath()
        ctx.arc(px + 16, py + 12, 11, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#3f8f45'
        ctx.beginPath()
        ctx.arc(px + 12, py + 10, 7, 0, Math.PI * 2)
        ctx.fill()
        break
      case TILE.WEED:
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.grassA : COLORS.grassB
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = COLORS.weed
        ctx.fillRect(px + 10, py + 14, 4, 10)
        ctx.fillRect(px + 16, py + 12, 4, 12)
        ctx.fillRect(px + 7, py + 16, 3, 8)
        break
      case TILE.FENCE:
        ctx.fillStyle = COLORS.fence
        ctx.fillRect(px + 4, py + 8, t - 8, 6)
        break
      default:
        ctx.fillStyle = '#000'
        ctx.fillRect(px, py, t, t)
    }
  }

  drawCrop(ctx, x, y, crop, t) {
    const def = CROPS[crop.cropId]
    if (!def) return
    const px = x * t
    const py = y * t
    const stage = crop.stage
    const max = def.stages - 1

    if (crop.mature) {
      ctx.font = '20px serif'
      ctx.textAlign = 'center'
      ctx.fillText(def.harvestEmoji, px + t / 2, py + t / 2 + 7)
      ctx.textAlign = 'left'
      // sparkle
      ctx.fillStyle = 'rgba(255,255,180,0.7)'
      ctx.fillRect(px + 6, py + 6, 3, 3)
      return
    }

    const h = 6 + (stage / Math.max(1, max)) * 16
    ctx.fillStyle = '#3d6b2f'
    ctx.fillRect(px + t / 2 - 2, py + t - 6 - h, 4, h)
    if (stage >= 1) {
      ctx.fillStyle = '#59a14f'
      ctx.beginPath()
      ctx.ellipse(px + t / 2 - 5, py + t - 8 - h * 0.4, 5, 3, -0.4, 0, Math.PI * 2)
      ctx.ellipse(px + t / 2 + 5, py + t - 8 - h * 0.4, 5, 3, 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
    if (stage >= max - 1) {
      ctx.font = '14px serif'
      ctx.textAlign = 'center'
      ctx.fillText(def.emoji, px + t / 2, py + t / 2)
      ctx.textAlign = 'left'
    }
  }

  drawPlayer(ctx, player, t) {
    const px = player.x * t
    const py = player.y * t
    const bob = Math.sin(player.anim * 10) * (player.moving ? 2 : 0)
    const lean = player.bump > 0 ? player.facing.x * 3 : 0

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(px, py + 10, 10, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    // body
    ctx.fillStyle = '#c45c26'
    ctx.fillRect(px - 8 + lean, py - 18 + bob, 16, 18)
    // head
    ctx.fillStyle = '#f0c9a0'
    ctx.fillRect(px - 7 + lean, py - 30 + bob, 14, 12)
    // hair
    ctx.fillStyle = '#5c3a21'
    ctx.fillRect(px - 7 + lean, py - 32 + bob, 14, 5)
    // eyes
    ctx.fillStyle = '#2b2118'
    const ex = player.facing.x * 2
    ctx.fillRect(px - 4 + lean + ex, py - 26 + bob, 2, 2)
    ctx.fillRect(px + 2 + lean + ex, py - 26 + bob, 2, 2)
    // tool flash
    if (player.bump > 0.3) {
      ctx.fillStyle = 'rgba(255,255,200,0.8)'
      ctx.fillRect(
        px + player.facing.x * 14 - 2,
        py + player.facing.y * 10 - 10 + bob,
        8,
        8,
      )
    }
  }
}

function dayFactor(minutes) {
  // 6:00-18:00 bright
  if (minutes >= 6 * 60 && minutes < 18 * 60) return 1
  if (minutes >= 5 * 60 && minutes < 6 * 60) return (minutes - 5 * 60) / 60
  if (minutes >= 18 * 60 && minutes < 20 * 60) return 1 - (minutes - 18 * 60) / 120
  return 0.15
}

function nightFactor(minutes) {
  return 1 - dayFactor(minutes)
}

function skyColor(minutes) {
  const f = dayFactor(minutes)
  if (f > 0.8) return '#87c6e0'
  if (minutes >= 17 * 60 && minutes < 20 * 60) return '#e09a5a'
  if (f < 0.3) return '#1a2744'
  return '#6fa8c9'
}

export { TILE_PX }
