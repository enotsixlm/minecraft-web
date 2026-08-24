import { CROPS } from './crops.js'

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
}

export const W = 32
export const H = 24

function idx(x, y) {
  return y * W + x
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < W && y < H
}

export class World {
  constructor(seed = 20260324) {
    this.seed = seed
    this.tiles = new Uint8Array(W * H)
    this.crops = new Map() // "x,y" -> { cropId, stage, days, wateredToday, mature }
    this.generate()
  }

  key(x, y) {
    return `${x},${y}`
  }

  generate() {
    this.tiles.fill(TILE.GRASS)
    this.crops.clear()

    // 池塘
    for (let y = 16; y <= 20; y++) {
      for (let x = 22; x <= 28; x++) {
        if ((x - 25) ** 2 / 12 + (y - 18) ** 2 / 6 < 1) this.tiles[idx(x, y)] = TILE.WATER
      }
    }

    // 农舍区域
    for (let y = 2; y <= 6; y++) {
      for (let x = 3; x <= 9; x++) {
        this.tiles[idx(x, y)] = TILE.FLOOR
      }
    }
    for (let x = 3; x <= 9; x++) {
      this.tiles[idx(x, 2)] = TILE.HOUSE
      this.tiles[idx(x, 6)] = TILE.HOUSE
    }
    for (let y = 2; y <= 6; y++) {
      this.tiles[idx(3, y)] = TILE.HOUSE
      this.tiles[idx(9, y)] = TILE.HOUSE
    }
    // 门口
    this.tiles[idx(6, 6)] = TILE.PATH
    this.tiles[idx(6, 5)] = TILE.FLOOR
    this.tiles[idx(6, 4)] = TILE.BED
    this.tiles[idx(5, 4)] = TILE.FLOOR
    this.tiles[idx(7, 4)] = TILE.FLOOR

    // 商店地块（地图右上）
    for (let y = 2; y <= 5; y++) {
      for (let x = 24; x <= 28; x++) this.tiles[idx(x, y)] = TILE.FLOOR
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

    // 可耕作农田区
    for (let y = 8; y <= 13; y++) {
      for (let x = 8; x <= 18; x++) {
        if (this.tiles[idx(x, y)] === TILE.GRASS) this.tiles[idx(x, y)] = TILE.DIRT
      }
    }

    // 树木与杂草
    const rng = mulberry32(this.seed)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.tiles[idx(x, y)]
        if (t !== TILE.GRASS) continue
        const edge = x < 2 || y < 1 || x > W - 3 || y > H - 2
        if (edge && rng() < 0.45) this.tiles[idx(x, y)] = TILE.TREE
        else if (rng() < 0.08) this.tiles[idx(x, y)] = TILE.WEED
      }
    }

    // 围栏
    for (let x = 7; x <= 19; x++) {
      if (this.tiles[idx(x, 7)] === TILE.GRASS || this.tiles[idx(x, 7)] === TILE.DIRT) {
        // leave open
      }
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
    return t !== TILE.WATER && t !== TILE.TREE && t !== TILE.HOUSE && t !== TILE.SHOP && t !== TILE.FENCE
  }

  getCrop(x, y) {
    return this.crops.get(this.key(x, y)) || null
  }

  till(x, y) {
    const t = this.get(x, y)
    if (t === TILE.GRASS || t === TILE.DIRT || t === TILE.WEED) {
      this.set(x, y, TILE.TILLED)
      this.crops.delete(this.key(x, y))
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
      const t = this.get(x, y)
      if (t === TILE.WATERED) this.set(x, y, TILE.TILLED)
    } else {
      this.crops.delete(this.key(x, y))
      this.set(x, y, TILE.TILLED)
    }
    return out
  }

  /** 过一天：浇过水的作物长大，未浇水不长；所有地块重置浇水状态 */
  advanceDay() {
    const grown = []
    for (const [k, crop] of this.crops) {
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

    // 浇过的地块变回耕地
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.get(x, y) === TILE.WATERED) this.set(x, y, TILE.TILLED)
      }
    }
    return grown
  }

  serialize() {
    return {
      seed: this.seed,
      tiles: Array.from(this.tiles),
      crops: Array.from(this.crops.entries()),
    }
  }

  static deserialize(data) {
    const w = new World(data.seed)
    w.tiles = Uint8Array.from(data.tiles)
    w.crops = new Map(data.crops)
    return w
  }
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
