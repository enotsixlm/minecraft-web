import { CROPS, TOOLS, seedItem, harvestItem, forageItem } from './crops.js'
import { TILE } from './world.js'

const MAX_ENERGY = 100

export class Player {
  constructor() {
    this.x = 6.5
    this.y = 8.5
    this.facing = { x: 0, y: 1 }
    this.energy = MAX_ENERGY
    this.gold = 500
    this.day = 1
    this.minutes = 6 * 60
    this.inventory = [
      { ...TOOLS.hoe, qty: 1 },
      { ...TOOLS.can, qty: 1 },
      { ...TOOLS.scythe, qty: 1 },
      { ...seedItem('parsnip'), qty: 15 },
      { ...seedItem('potato'), qty: 5 },
      null,
      null,
      null,
    ]
    this.selected = 0
    this.anim = 0
    this.bump = 0
    this.moving = false
  }

  get maxEnergy() {
    return MAX_ENERGY
  }

  selectedItem() {
    return this.inventory[this.selected] || null
  }

  addItem(item, qty = 1) {
    for (const slot of this.inventory) {
      if (slot && slot.id === item.id && slot.kind !== 'tool') {
        slot.qty = (slot.qty || 0) + qty
        return true
      }
    }
    for (let i = 0; i < this.inventory.length; i++) {
      if (!this.inventory[i]) {
        this.inventory[i] = { ...item, qty }
        return true
      }
    }
    return false
  }

  consumeSelected(n = 1) {
    const it = this.selectedItem()
    if (!it || it.kind === 'tool') return false
    it.qty -= n
    if (it.qty <= 0) this.inventory[this.selected] = null
    return true
  }

  spendEnergy(n) {
    if (this.energy < n) return false
    this.energy -= n
    return true
  }

  restoreEnergy() {
    this.energy = MAX_ENERGY
  }

  targetTile() {
    const tx = Math.floor(this.x + this.facing.x * 0.85)
    const ty = Math.floor(this.y + this.facing.y * 0.85)
    return { x: tx, y: ty }
  }

  tryUse(world) {
    const item = this.selectedItem()
    const { x, y } = this.targetTile()
    this.bump = 1

    // 采集物：空手或任意物品都可拾取
    const forageId = world.getForage(x, y)
    if (forageId) {
      if (!this.spendEnergy(1)) return { ok: false, msg: '体力不足' }
      const picked = world.pickForage(x, y)
      if (!this.addItem(forageItem(picked), 1)) {
        this.energy += 1
        world.forage.set(world.key(x, y), picked)
        return { ok: false, msg: '背包满了' }
      }
      return { ok: true, msg: `捡到了${forageItem(picked).name}`, sfx: 'harvest' }
    }

    // 出货箱：放入当前选中的可售物品
    if (world.get(x, y) === TILE.SHIPPING) {
      if (!item || item.kind !== 'crop') {
        const pending = world.shipping.reduce((n, s) => n + s.qty, 0)
        return {
          ok: false,
          msg: pending ? `出货箱里有 ${pending} 件，睡后结算` : '对着出货箱放入收获物',
        }
      }
      const qty = item.qty || 1
      world.shipItem(item, qty)
      this.inventory[this.selected] = null
      return { ok: true, msg: `装入出货箱 ×${qty}（睡后到账）`, sfx: 'coin' }
    }

    if (!item) return { ok: false, msg: '空手无物' }

    if (item.id === 'hoe') {
      if (!this.spendEnergy(2)) return { ok: false, msg: '体力不足' }
      if (world.breakRock(x, y)) return { ok: true, msg: '石头敲碎了', sfx: 'hoe' }
      if (world.till(x, y)) return { ok: true, msg: '翻土完成', sfx: 'hoe' }
      return { ok: false, msg: '这里不能耕地', refund: 2 }
    }

    if (item.id === 'can') {
      if (!this.spendEnergy(2)) return { ok: false, msg: '体力不足' }
      if (world.water(x, y)) return { ok: true, msg: '浇水啦', sfx: 'water' }
      return { ok: false, msg: '这里不需要浇水', refund: 2 }
    }

    if (item.id === 'scythe') {
      const harvested = world.harvest(x, y)
      if (harvested) {
        if (!this.spendEnergy(1)) return { ok: false, msg: '体力不足' }
        const ok = this.addItem(harvestItem(harvested.cropId), harvested.qty)
        if (!ok) {
          this.energy += 1
          return { ok: false, msg: '背包满了' }
        }
        return { ok: true, msg: `收获了 ${CROPS[harvested.cropId].name}`, sfx: 'harvest' }
      }
      if (world.clearWeed(x, y)) {
        if (!this.spendEnergy(1)) return { ok: false, msg: '体力不足' }
        return { ok: true, msg: '杂草清除', sfx: 'hoe' }
      }
      return { ok: false, msg: '没有可收割的' }
    }

    if (item.kind === 'seed') {
      if (!this.spendEnergy(1)) return { ok: false, msg: '体力不足' }
      if (world.plant(x, y, item.cropId)) {
        this.consumeSelected(1)
        return { ok: true, msg: `种下了${CROPS[item.cropId].name}`, sfx: 'plant' }
      }
      return { ok: false, msg: '需要已翻好的土地', refund: 1 }
    }

    if (item.kind === 'crop') {
      return { ok: false, msg: '对着屋外棕色出货箱放入，或去商店卖掉' }
    }

    return { ok: false, msg: '无法使用' }
  }

  finishAction(result) {
    if (result && result.refund) this.energy = Math.min(MAX_ENERGY, this.energy + result.refund)
  }

  buySeed(cropId) {
    const c = CROPS[cropId]
    if (!c) return { ok: false, msg: '没有这种种子' }
    if (this.gold < c.seedPrice) return { ok: false, msg: '金币不够' }
    if (!this.addItem(seedItem(cropId), 1)) return { ok: false, msg: '背包满了' }
    this.gold -= c.seedPrice
    return { ok: true, msg: `买到了${c.seedName}` }
  }

  sellAllCrops() {
    let earned = 0
    let count = 0
    for (let i = 0; i < this.inventory.length; i++) {
      const it = this.inventory[i]
      if (it && it.kind === 'crop') {
        earned += (it.sellPrice || CROPS[it.cropId]?.sellPrice || 0) * it.qty
        count += it.qty
        this.inventory[i] = null
      }
    }
    this.gold += earned
    return { earned, count }
  }

  nearBed(world) {
    const cx = Math.floor(this.x)
    const cy = Math.floor(this.y)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (world.get(cx + dx, cy + dy) === TILE.BED) return true
      }
    }
    return false
  }

  nearShop() {
    const cx = Math.floor(this.x)
    const cy = Math.floor(this.y)
    return cx >= 25 && cx <= 27 && cy >= 4 && cy <= 6
  }

  serialize() {
    return {
      x: this.x,
      y: this.y,
      facing: this.facing,
      energy: this.energy,
      gold: this.gold,
      day: this.day,
      minutes: this.minutes,
      inventory: this.inventory,
      selected: this.selected,
    }
  }

  load(data) {
    Object.assign(this, data)
  }
}
