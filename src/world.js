import { CROPS, FORAGE } from './crops.js'

export const TILE = {
  GRASS: 0,
  DIRT: 1,
  TILLED: 2,
  WATERED: 3,
  WATER: 4,
  PATH: 5,
  FENCE: 6,
  HOUSE: 7,
  BED: 8,
  TREE: 9,
  WEED: 10,
  SHOP: 11,
  FLOOR: 12,
  SHIPPING: 13,
  ROCK: 14,
}

export const W = 32
export const H = 24

function idx(x, y) {
  return y * W + x
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < W && y < H
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class World {
  constructor(seed = 20260324) {
    this.seed = seed
    this.tiles = new Uint8Array(W * H)
    this.crops = new Map()
    this.forage = new Map() // "x,y" -> forageId
    this.shipping = [] // [{ id, name, sellPrice, qty }]
    this.chicken = { x: 20.5, y: 9.5, vx: 0.4, vy: 0, t: 0 }
    this.generate()
  }

  key(x, y) {
    return `${x},${y}`
  }

  generate() {
    this.tiles.fill(TILE.GRASS)
    this.crops.clear()
    this.forage.clear()
    this.shipping = []

    const rng = mulberry32(this.seed)

    // 池塘
    for (let y = 16; y <= 20; y++) {
      for (let x = 22; x <= 28; x++) {
        if ((x - 25) ** 2 / 12 + (y - 18) ** 2 / 6 < 1) this.tiles[idx(x, y)] = TILE.WATER
      }
    }

    // 农舍地板
    for (let y = 3; y <= 5; y++) {
      for (let x = 4; x <= 8; x++) this.tiles[idx(x, y)] = TILE.FLOOR
    }
    // 农舍墙（渲染时画成完整小屋）
    for (let x = 3; x <= 9; x++) {
      this.tiles[idx(x, 2)] = TILE.HOUSE
      this.tiles[idx(x, 6)] = TILE.HOUSE
    }
    for (let y = 2; y <= 6; y++) {
      this.tiles[idx(3, y)] = TILE.HOUSE
      this.tiles[idx(9, y)] = TILE.HOUSE
    }
    this.tiles[idx(6, 6)] = TILE.PATH
    this.tiles[idx(6, 5)] = TILE.FLOOR
    this.tiles[idx(6, 4)] = TILE.BED
    this.tiles[idx(5, 4)] = TILE.FLOOR
    this.tiles[idx(7, 4)] = TILE.FLOOR

    // 出货箱（屋外）
    this.tiles[idx(8, 7)] = TILE.SHIPPING

    // 商店
    for (let y = 3; y <= 4; y++) {
      for (let x = 25; x <= 27; x++) this.tiles[idx(x, y)] = TILE.FLOOR
    }
    for (let x = 24; x <= 28; x++) {
      this.tiles[idx(x, 2)] = TILE.SHOP
      this.tiles[idx(x, 5)] = TILE.SHOP
    }
    for (let y = 2; y <= 5; y++) {
      this.tiles[idx(24, y)] = TILE.SHOP
      this.tiles[idx(28, y)] = TILE.SHOP
    }
    this.tiles[idx(26, 5)] = TILE.PATH
    this.tiles[idx(26, 4)] = TILE.FLOOR

    // 小路
    for (let y = 7; y <= 14; y++) this.tiles[idx(6, y)] = TILE.PATH
    for (let x = 6; x <= 26; x++) this.tiles[idx(x, 14)] = TILE.PATH
    for (let y = 5; y <= 14; y++) this.tiles[idx(26, y)] = TILE.PATH

    // 农田
    for (let y = 8; y <= 13; y++) {
      for (let x = 8; x <= 18; x++) {
        if (this.tiles[idx(x, y)] === TILE.GRASS) this.tiles[idx(x, y)] = TILE.DIRT
      }
    }

    // 农田木栅栏
    for (let x = 7; x <= 19; x++) {
      if (this.get(x, 7) === TILE.GRASS || this.get(x, 7) === TILE.DIRT) this.set(x, 7, TILE.FENCE)
    }
    this.set(6, 7, TILE.PATH)
    for (let y = 8; y <= 13; y++) {
      this.set(7, y, TILE.FENCE)
      this.set(19, y, TILE.FENCE)
    }
    // 从左侧小路进农田的缺口
    this.set(7, 10, TILE.DIRT)

    // 鸡舍旁空地
    for (let y = 8; y <= 10; y++) {
      for (let x = 20; x <= 21; x++) {
        if (this.get(x, y) === TILE.GRASS) this.set(x, y, TILE.PATH)
      }
    }

    // 树木、杂草、石头
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.tiles[idx(x, y)]
        if (t !== TILE.GRASS) continue
        const edge = x < 2 || y < 1 || x > W - 3 || y > H - 2
        if (edge && rng() < 0.5) this.tiles[idx(x, y)] = TILE.TREE
        else if (rng() < 0.07) this.tiles[idx(x, y)] = TILE.WEED
        else if (rng() < 0.04) this.tiles[idx(x, y)] = TILE.ROCK
      }
    }

    this.spawnForage(rng)
    this.chicken = { x: 20.5, y: 9.5, vx: 0.35, vy: 0, t: 0 }
  }

  spawnForage(rng = Math.random) {
    const ids = Object.keys(FORAGE)
    let placed = 0
    let guard = 0
    while (placed < 8 && guard++ < 200) {
      const x = 1 + Math.floor(rng() * (W - 2))
      const y = 1 + Math.floor(rng() * (H - 2))
      if (this.get(x, y) !== TILE.GRASS) continue
      if (this.forage.has(this.key(x, y))) continue
      this.forage.set(this.key(x, y), ids[Math.floor(rng() * ids.length)])
      placed++
    }
  }

  get(x, y) {
    if (!inBounds(x, y)) return TILE.WATER
    return this.tiles[idx(x, y)]
  }

  set(x, y, t) {
    if (!inBounds(x, y)) return
    this.tiles[idx(x, y)] = t
  }

  walkable(x, y) {
    if (!inBounds(x, y)) return false
    const t = this.get(x, y)
    return (
      t !== TILE.WATER &&
      t !== TILE.TREE &&
      t !== TILE.HOUSE &&
      t !== TILE.SHOP &&
      t !== TILE.FENCE &&
      t !== TILE.ROCK &&
      t !== TILE.SHIPPING
    )
  }

  getCrop(x, y) {
    return this.crops.get(this.key(x, y)) || null
  }

  getForage(x, y) {
    return this.forage.get(this.key(x, y)) || null
  }

  pickForage(x, y) {
    const k = this.key(x, y)
    const id = this.forage.get(k)
    if (!id) return null
    this.forage.delete(k)
    return id
  }

  till(x, y) {
    const t = this.get(x, y)
    if (t === TILE.GRASS || t === TILE.DIRT || t === TILE.WEED) {
      this.set(x, y, TILE.TILLED)
      this.crops.delete(this.key(x, y))
      this.forage.delete(this.key(x, y))
      return true
    }
    return false
  }

  water(x, y) {
    const crop = this.getCrop(x, y)
    const t = this.get(x, y)
    if (t === TILE.TILLED) {
      this.set(x, y, TILE.WATERED)
      if (crop) crop.wateredToday = true
      return true
    }
    if (t === TILE.WATERED) {
      if (crop) crop.wateredToday = true
      return true
    }
    return false
  }

  plant(x, y, cropId) {
    const t = this.get(x, y)
    if ((t !== TILE.TILLED && t !== TILE.WATERED) || this.getCrop(x, y)) return false
    if (!CROPS[cropId]) return false
    this.crops.set(this.key(x, y), {
      cropId,
      stage: 0,
      days: 0,
      wateredToday: t === TILE.WATERED,
      mature: false,
    })
    return true
  }

  clearWeed(x, y) {
    if (this.get(x, y) === TILE.WEED) {
      this.set(x, y, TILE.GRASS)
      return true
    }
    return false
  }

  breakRock(x, y) {
    if (this.get(x, y) === TILE.ROCK) {
      this.set(x, y, TILE.GRASS)
      return true
    }
    return false
  }

  harvest(x, y) {
    const crop = this.getCrop(x, y)
    if (!crop || !crop.mature) return null
    const def = CROPS[crop.cropId]
    const out = { cropId: crop.cropId, qty: 1 }
    if (def.regrow) {
      crop.mature = false
      crop.days = def.daysToGrow - def.regrow
      crop.stage = Math.max(0, def.stages - 2)
      crop.wateredToday = false
      if (this.get(x, y) === TILE.WATERED) this.set(x, y, TILE.TILLED)
    } else {
      this.crops.delete(this.key(x, y))
      this.set(x, y, TILE.TILLED)
    }
    return out
  }

  shipItem(item, qty) {
    this.shipping.push({
      id: item.id,
      name: item.name,
      sellPrice: item.sellPrice || 0,
      qty,
    })
  }

  settleShipping() {
    let earned = 0
    let count = 0
    for (const s of this.shipping) {
      earned += s.sellPrice * s.qty
      count += s.qty
    }
    this.shipping = []
    return { earned, count }
  }

  advanceDay() {
    const grown = []
    for (const [, crop] of this.crops) {
      const def = CROPS[crop.cropId]
      if (crop.wateredToday && !crop.mature) {
        crop.days += 1
        const progress = crop.days / def.daysToGrow
        crop.stage = Math.min(def.stages - 1, Math.floor(progress * def.stages))
        if (crop.days >= def.daysToGrow) {
          crop.mature = true
          crop.stage = def.stages - 1
          grown.push(def.name)
        }
      }
      crop.wateredToday = false
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.get(x, y) === TILE.WATERED) this.set(x, y, TILE.TILLED)
      }
    }

    // 采集物每日刷新一点
    this.spawnForage(mulberry32(this.seed + Date.now() % 100000))
    return grown
  }

  updateChicken(dt) {
    const c = this.chicken
    c.t += dt
    if (c.t > 1.8) {
      c.t = 0
      const ang = Math.random() * Math.PI * 2
      c.vx = Math.cos(ang) * 0.5
      c.vy = Math.sin(ang) * 0.5
    }
    const nx = c.x + c.vx * dt
    const ny = c.y + c.vy * dt
    if (this.walkable(Math.floor(nx), Math.floor(c.y)) && nx > 19.2 && nx < 22.5) c.x = nx
    else c.vx *= -1
    if (this.walkable(Math.floor(c.x), Math.floor(ny)) && ny > 7.5 && ny < 11.5) c.y = ny
    else c.vy *= -1
  }

  serialize() {
    return {
      seed: this.seed,
      tiles: Array.from(this.tiles),
      crops: Array.from(this.crops.entries()),
      forage: Array.from(this.forage.entries()),
      shipping: this.shipping,
      chicken: this.chicken,
    }
  }

  static deserialize(data) {
    const w = new World(data.seed)
    w.tiles = Uint8Array.from(data.tiles)
    w.crops = new Map(data.crops)
    w.forage = new Map(data.forage || [])
    w.shipping = data.shipping || []
    if (data.chicken) w.chicken = data.chicken
    return w
  }
}


