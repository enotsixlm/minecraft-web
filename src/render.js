import { TILE, W, H } from './world.js'
import { CROPS, FORAGE } from './crops.js'

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
  floor: '#d4b896',
  bed: '#6b8cae',
  treeTrunk: '#6b4423',
  treeLeaf: '#2f6b32',
  weed: '#6aa84f',
  fence: '#7a5230',
  rock: '#8a8680',
  shipping: '#6b3f1f',
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
    this.time = 0
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
    this.time += dt
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

    this.camX = player.x * t - w / 2
    this.camY = player.y * t - h / 2
    this.camX = Math.max(-40, Math.min(this.camX, W * t - w + 40))
    this.camY = Math.max(-40, Math.min(this.camY, H * t - h + 40))
    if (W * t < w) this.camX = (W * t - w) / 2
    if (H * t < h) this.camY = (H * t - h) / 2

    const sx = this.shake ? (Math.random() - 0.5) * 4 * this.shake : 0
    const sy = this.shake ? (Math.random() - 0.5) * 4 * this.shake : 0

    ctx.fillStyle = skyColor(timeOfDay)
    ctx.fillRect(0, 0, w, h)

    const g = ctx.createRadialGradient(w * 0.72, h * 0.12, 8, w * 0.72, h * 0.12, 260)
    g.addColorStop(0, `rgba(255, 220, 120, ${0.4 * dayFactor(timeOfDay)})`)
    g.addColorStop(1, 'rgba(255,220,120,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(-this.camX + sx, -this.camY + sy)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        this.drawTile(ctx, x, y, world.get(x, y), t)
        const fid = world.getForage(x, y)
        if (fid) this.drawForage(ctx, x, y, fid, t)
        const crop = world.getCrop(x, y)
        if (crop) this.drawCrop(ctx, x, y, crop, t)
      }
    }

    this.drawHouse(ctx, t)
    this.drawShop(ctx, t)
    this.drawChicken(ctx, world.chicken, t)
    this.drawPlayer(ctx, player, t)

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
      ctx.globalAlpha = 1
    }

    const tg = player.targetTile()
    ctx.strokeStyle = 'rgba(255,255,200,0.7)'
    ctx.lineWidth = 2
    ctx.strokeRect(tg.x * t + 2, tg.y * t + 2, t - 4, t - 4)

    ctx.restore()

    const night = nightFactor(timeOfDay)
    if (night > 0.05) {
      ctx.fillStyle = `rgba(10, 16, 40, ${night * 0.55})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  drawTile(ctx, x, y, type, t) {
    const px = x * t
    const py = y * t
    const checker = (x + y) % 2 === 0

    const grass = () => {
      ctx.fillStyle = checker ? COLORS.grassA : COLORS.grassB
      ctx.fillRect(px, py, t, t)
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(px + 7, py + 10, 2, 2)
    }

    switch (type) {
      case TILE.GRASS:
        grass()
        break
      case TILE.DIRT:
        ctx.fillStyle = COLORS.dirt
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = 'rgba(0,0,0,0.08)'
        ctx.fillRect(px + 4, py + 6, 5, 3)
        break
      case TILE.TILLED:
        ctx.fillStyle = COLORS.tilled
        ctx.fillRect(px, py, t, t)
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'
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
        ctx.fillStyle = 'rgba(80,140,200,0.38)'
        ctx.fillRect(px + 2, py + 2, t - 4, t - 4)
        break
      case TILE.WATER: {
        const wave = Math.sin(this.time * 2 + x * 0.7 + y) * 2
        ctx.fillStyle = COLORS.water
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = COLORS.waterDeep
        ctx.fillRect(px + 3, py + 10 + wave, t - 6, 5)
        ctx.fillStyle = 'rgba(200,240,255,0.28)'
        ctx.fillRect(px + 5, py + 4 + wave, 10, 3)
        break
      }
      case TILE.PATH:
        ctx.fillStyle = COLORS.path
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = 'rgba(0,0,0,0.07)'
        ctx.fillRect(px + 12, py + 14, 3, 3)
        break
      case TILE.HOUSE:
      case TILE.SHOP:
        grass()
        break
      case TILE.FLOOR:
        ctx.fillStyle = COLORS.floor
        ctx.fillRect(px, py, t, t)
        ctx.strokeStyle = 'rgba(120,80,40,0.15)'
        ctx.strokeRect(px + 0.5, py + 0.5, t - 1, t - 1)
        break
      case TILE.BED:
        ctx.fillStyle = COLORS.floor
        ctx.fillRect(px, py, t, t)
        ctx.fillStyle = COLORS.bed
        ctx.fillRect(px + 4, py + 6, t - 8, t - 10)
        ctx.fillStyle = '#fff8e7'
        ctx.fillRect(px + 6, py + 8, 10, 6)
        break
      case TILE.TREE:
        grass()
        ctx.fillStyle = COLORS.treeTrunk
        ctx.fillRect(px + 13, py + 16, 6, 12)
        ctx.fillStyle = COLORS.treeLeaf
        ctx.beginPath()
        ctx.arc(px + 16, py + 12, 11, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#3f8f45'
        ctx.beginPath()
        ctx.arc(px + 11, py + 10, 7, 0, Math.PI * 2)
        ctx.fill()
        break
      case TILE.WEED:
        grass()
        ctx.fillStyle = COLORS.weed
        ctx.fillRect(px + 10, py + 14, 4, 10)
        ctx.fillRect(px + 16, py + 12, 4, 12)
        ctx.fillRect(px + 7, py + 16, 3, 8)
        break
      case TILE.FENCE:
        grass()
        ctx.fillStyle = COLORS.fence
        ctx.fillRect(px + 4, py + 10, t - 8, 6)
        ctx.fillRect(px + 8, py + 6, 4, 16)
        ctx.fillRect(px + 20, py + 6, 4, 16)
        break
      case TILE.ROCK:
        grass()
        ctx.fillStyle = COLORS.rock
        ctx.beginPath()
        ctx.moveTo(px + 8, py + 22)
        ctx.lineTo(px + 6, py + 14)
        ctx.lineTo(px + 14, py + 8)
        ctx.lineTo(px + 24, py + 12)
        ctx.lineTo(px + 26, py + 22)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.fillRect(px + 12, py + 12, 4, 3)
        break
      case TILE.SHIPPING:
        grass()
        ctx.fillStyle = COLORS.shipping
        ctx.fillRect(px + 4, py + 10, t - 8, 16)
        ctx.fillStyle = '#8b5a2b'
        ctx.fillRect(px + 2, py + 8, t - 4, 5)
        ctx.fillStyle = '#f4d35e'
        ctx.fillRect(px + 12, py + 16, 8, 6)
        break
      default:
        ctx.fillStyle = '#000'
        ctx.fillRect(px, py, t, t)
    }
  }

  drawHouse(ctx, t) {
    const ox = 3 * t
    const oy = 1.2 * t
    // roof
    ctx.fillStyle = '#a63d2a'
    ctx.beginPath()
    ctx.moveTo(ox - 4, oy + 28)
    ctx.lineTo(ox + 3.5 * t, oy - 8)
    ctx.lineTo(ox + 7 * t + 4, oy + 28)
    ctx.closePath()
    ctx.fill()
    // body
    ctx.fillStyle = '#e8d2a8'
    ctx.fillRect(ox + 8, oy + 26, 7 * t - 16, 4.2 * t)
    // door
    ctx.fillStyle = '#6b4423'
    ctx.fillRect(ox + 3 * t - 8, oy + 4.4 * t, 18, 28)
    // window
    ctx.fillStyle = '#7ec8e3'
    ctx.fillRect(ox + 1.2 * t, oy + 2.8 * t, 16, 14)
    ctx.fillRect(ox + 5 * t, oy + 2.8 * t, 16, 14)
    ctx.fillStyle = '#fff4d6'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText('农舍', ox + 2.8 * t, oy + 1.6 * t)
  }

  drawShop(ctx, t) {
    const ox = 24 * t
    const oy = 1.2 * t
    ctx.fillStyle = '#b8860b'
    ctx.beginPath()
    ctx.moveTo(ox - 2, oy + 26)
    ctx.lineTo(ox + 2.5 * t, oy - 4)
    ctx.lineTo(ox + 5 * t + 2, oy + 26)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#f0e0b8'
    ctx.fillRect(ox + 6, oy + 24, 5 * t - 12, 3.6 * t)
    ctx.fillStyle = '#6b4423'
    ctx.fillRect(ox + 2 * t - 6, oy + 3.6 * t, 16, 26)
    ctx.fillStyle = '#c45c26'
    ctx.fillRect(ox + 10, oy + 1.8 * t, 5 * t - 20, 12)
    ctx.fillStyle = '#fff4d6'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText('皮埃尔', ox + 1.4 * t, oy + 2.55 * t)
  }

  drawForage(ctx, x, y, id, t) {
    const f = FORAGE[id]
    if (!f) return
    const px = x * t + t / 2
    const py = y * t + t / 2
    const bob = Math.sin(this.time * 3 + x) * 1.5
    ctx.fillStyle = f.color
    ctx.beginPath()
    ctx.arc(px, py + bob, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#3d7a3a'
    ctx.fillRect(px - 1, py + 4 + bob, 2, 6)
  }

  drawCrop(ctx, x, y, crop, t) {
    const def = CROPS[crop.cropId]
    if (!def) return
    const px = x * t
    const py = y * t
    const stage = crop.stage
    const max = def.stages - 1

    if (crop.mature) {
      ctx.fillStyle = def.leaf
      ctx.fillRect(px + 10, py + 18, 4, 8)
      ctx.fillRect(px + 18, py + 18, 4, 8)
      ctx.fillStyle = def.color
      ctx.beginPath()
      ctx.arc(px + t / 2, py + 14, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,180,0.8)'
      ctx.fillRect(px + 8, py + 8, 3, 3)
      return
    }

    const h = 5 + (stage / Math.max(1, max)) * 14
    ctx.fillStyle = '#3d6b2f'
    ctx.fillRect(px + t / 2 - 2, py + t - 6 - h, 4, h)
    if (stage >= 1) {
      ctx.fillStyle = def.leaf
      ctx.beginPath()
      ctx.ellipse(px + t / 2 - 5, py + t - 8 - h * 0.35, 5, 3, -0.4, 0, Math.PI * 2)
      ctx.ellipse(px + t / 2 + 5, py + t - 8 - h * 0.35, 5, 3, 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
    if (stage >= max - 1) {
      ctx.fillStyle = def.color
      ctx.beginPath()
      ctx.arc(px + t / 2, py + t - 10 - h * 0.5, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  drawChicken(ctx, c, t) {
    if (!c) return
    const px = c.x * t
    const py = c.y * t
    const bob = Math.sin(c.t * 10) * 1.5
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.ellipse(px, py + 6, 8, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f4f0e4'
    ctx.fillRect(px - 7, py - 6 + bob, 14, 10)
    ctx.fillStyle = '#f0c9a0'
    ctx.fillRect(px + 4, py - 8 + bob, 8, 7)
    ctx.fillStyle = '#e23d3d'
    ctx.fillRect(px + 10, py - 5 + bob, 4, 3)
    ctx.fillStyle = '#2b2118'
    ctx.fillRect(px + 8, py - 6 + bob, 2, 2)
  }

  drawPlayer(ctx, player, t) {
    const px = player.x * t
    const py = player.y * t
    const bob = Math.sin(player.anim * 10) * (player.moving ? 2 : 0)
    const lean = player.bump > 0 ? player.facing.x * 3 : 0

    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(px, py + 10, 10, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#2f6b9a'
    ctx.fillRect(px - 8 + lean, py - 18 + bob, 16, 18)
    ctx.fillStyle = '#f0c9a0'
    ctx.fillRect(px - 7 + lean, py - 30 + bob, 14, 12)
    ctx.fillStyle = '#5c3a21'
    ctx.fillRect(px - 7 + lean, py - 32 + bob, 14, 5)
    ctx.fillStyle = '#2b2118'
    const ex = player.facing.x * 2
    ctx.fillRect(px - 4 + lean + ex, py - 26 + bob, 2, 2)
    ctx.fillRect(px + 2 + lean + ex, py - 26 + bob, 2, 2)

    if (player.bump > 0.3) {
      ctx.fillStyle = 'rgba(255,255,200,0.85)'
      ctx.fillRect(px + player.facing.x * 14 - 2, py + player.facing.y * 10 - 10 + bob, 8, 8)
    }
  }
}

/** 快捷栏像素图标 */
export function drawItemIcon(canvas, item) {
  const ctx = canvas.getContext('2d')
  const s = 28
  canvas.width = s
  canvas.height = s
  ctx.clearRect(0, 0, s, s)
  if (!item) return
  if (item.icon === 'hoe') {
    ctx.fillStyle = '#8b5a2b'
    ctx.fillRect(12, 4, 4, 18)
    ctx.fillStyle = '#888'
    ctx.fillRect(6, 4, 16, 6)
  } else if (item.icon === 'can') {
    ctx.fillStyle = '#4a90c8'
    ctx.fillRect(8, 10, 14, 12)
    ctx.fillRect(18, 6, 6, 6)
    ctx.fillStyle = '#7ec8e3'
    ctx.fillRect(20, 2, 3, 6)
  } else if (item.icon === 'scythe') {
    ctx.fillStyle = '#8b5a2b'
    ctx.fillRect(12, 6, 4, 18)
    ctx.fillStyle = '#c0c0c0'
    ctx.beginPath()
    ctx.arc(14, 8, 10, -0.2, 1.4)
    ctx.lineTo(14, 8)
    ctx.fill()
  } else if (item.icon === 'seed') {
    ctx.fillStyle = '#6b4423'
    ctx.fillRect(10, 16, 8, 6)
    ctx.fillStyle = item.color || '#8fd17a'
    ctx.beginPath()
    ctx.arc(14, 12, 5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = item.color || '#f4d35e'
    ctx.beginPath()
    ctx.arc(14, 14, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#3d7a3a'
    ctx.fillRect(12, 18, 4, 6)
  }
}

function dayFactor(minutes) {
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
