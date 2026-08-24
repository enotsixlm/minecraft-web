import { World, TILE } from './world.js'
import { Player } from './player.js'
import { Renderer } from './render.js'
import { AudioBus } from './audio.js'
import { CROPS, SHOP_SEEDS } from './crops.js'

const SAVE_KEY = 'stardew-farm-web-v1'

const canvas = document.getElementById('game')
const renderer = new Renderer(canvas)
const audio = new AudioBus()

const ui = {
  menu: document.getElementById('menu'),
  shop: document.getElementById('shop'),
  sleep: document.getElementById('sleep'),
  gold: document.getElementById('gold'),
  energyText: document.getElementById('energy-text'),
  energyBar: document.getElementById('energy-bar'),
  day: document.getElementById('day'),
  clock: document.getElementById('clock'),
  hotbar: document.getElementById('hotbar'),
  toast: document.getElementById('toast'),
  shopCatalog: document.getElementById('shop-catalog'),
  sleepSummary: document.getElementById('sleep-summary'),
  btnPlay: document.getElementById('btn-play'),
  btnContinue: document.getElementById('btn-continue'),
  btnReset: document.getElementById('btn-reset'),
  btnCloseShop: document.getElementById('btn-close-shop'),
  btnSellAll: document.getElementById('btn-sell-all'),
  btnWake: document.getElementById('btn-wake'),
}

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  use: false,
  usePressed: false,
}

const game = {
  world: null,
  player: null,
  running: false,
  paused: true,
  last: 0,
  toastTimer: 0,
  timeAcc: 0,
}

function freshGame() {
  game.world = new World()
  game.player = new Player()
}

function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY)
  } catch {
    return false
  }
}

function save() {
  if (!game.world || !game.player) return
  const data = {
    world: game.world.serialize(),
    player: game.player.serialize(),
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    game.world = World.deserialize(data.world)
    game.player = new Player()
    game.player.load(data.player)
    return true
  } catch {
    return false
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.floor(minutes % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function toast(msg) {
  ui.toast.textContent = msg
  ui.toast.classList.add('show')
  game.toastTimer = 1.6
}

function updateHUD() {
  const p = game.player
  if (!p) return
  ui.gold.textContent = `${p.gold} G`
  ui.energyText.textContent = `${Math.max(0, Math.ceil(p.energy))} / ${p.maxEnergy}`
  ui.energyBar.style.transform = `scaleX(${Math.max(0, p.energy / p.maxEnergy)})`
  ui.day.textContent = `春日 ${p.day}`
  ui.clock.textContent = formatClock(p.minutes)

  ui.hotbar.innerHTML = ''
  p.inventory.forEach((item, i) => {
    const el = document.createElement('div')
    el.className = 'slot' + (i === p.selected ? ' selected' : '')
    el.innerHTML = `
      <span class="key">${i + 1}</span>
      <span class="icon">${item ? item.emoji : ''}</span>
      <span class="name">${item ? item.name.slice(0, 4) : ''}</span>
      ${item && item.kind !== 'tool' && item.qty ? `<span class="qty">${item.qty}</span>` : ''}
    `
    ui.hotbar.appendChild(el)
  })
}

function buildShop() {
  ui.shopCatalog.innerHTML = ''
  for (const id of SHOP_SEEDS) {
    const c = CROPS[id]
    const el = document.createElement('div')
    el.className = 'shop-item'
    el.innerHTML = `
      <div class="title">${c.harvestEmoji} ${c.seedName}</div>
      <div class="desc">${c.description}<br/>生长 ${c.daysToGrow} 天 · 售价 ${c.sellPrice}G</div>
      <div class="price">${c.seedPrice} G</div>
    `
    el.addEventListener('click', () => {
      const r = game.player.buySeed(id)
      audio.play(r.ok ? 'coin' : 'error')
      toast(r.msg)
      updateHUD()
      save()
    })
    ui.shopCatalog.appendChild(el)
  }
}

function openShop() {
  buildShop()
  ui.shop.classList.remove('hidden')
  game.paused = true
  audio.play('ui')
}

function closeShop() {
  ui.shop.classList.add('hidden')
  game.paused = false
  audio.play('ui')
}

function sleep() {
  const grown = game.world.advanceDay()
  game.player.day += 1
  game.player.minutes = 6 * 60
  game.player.restoreEnergy()
  const unique = [...new Set(grown)]
  ui.sleepSummary.innerHTML = `
    <div>新的一天：<strong>春日 ${game.player.day}</strong></div>
    <div>体力已恢复至满值。</div>
    <div>${unique.length ? `长大的作物：${unique.join('、')}` : '昨晚没有作物长大（记得浇水哦）。'}</div>
    <div style="margin-top:8px;opacity:.8">农场存档已自动保存。</div>
  `
  ui.sleep.classList.remove('hidden')
  game.paused = true
  audio.play('day')
  save()
  updateHUD()
}

function wake() {
  ui.sleep.classList.add('hidden')
  game.paused = false
  // spawn just outside house door
  game.player.x = 6.5
  game.player.y = 7.5
  audio.play('ui')
}

function startPlaying(fromSave) {
  if (fromSave) {
    if (!load()) freshGame()
  } else {
    freshGame()
    save()
  }
  ui.menu.classList.add('hidden')
  game.running = true
  game.paused = false
  game.last = performance.now()
  updateHUD()
  audio.ensure()
  audio.play('ui')
  requestAnimationFrame(loop)
}

function tryUseTool() {
  const result = game.player.tryUse(game.world)
  game.player.finishAction(result)
  if (result.ok) {
    toast(result.msg)
    if (result.sfx) audio.play(result.sfx)
    renderer.shake = 0.35
    const tg = game.player.targetTile()
    const color =
      result.sfx === 'water' ? '#7ec8e3' : result.sfx === 'harvest' ? '#f4d35e' : '#c4a574'
    renderer.burst(tg.x, tg.y, color, 10)
  } else if (result.msg) {
    toast(result.msg)
    audio.play('error')
  }
  updateHUD()
  save()
}

function movePlayer(dt) {
  const p = game.player
  let dx = 0
  let dy = 0
  if (input.up) dy -= 1
  if (input.down) dy += 1
  if (input.left) dx -= 1
  if (input.right) dx += 1
  p.moving = dx !== 0 || dy !== 0
  if (p.moving) {
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    p.facing = { x: Math.round(dx) || (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0), y: Math.round(dy) || (Math.abs(dy) >= Math.abs(dx) ? Math.sign(dy) : 0) }
    if (p.facing.x === 0 && p.facing.y === 0) p.facing = { x: Math.sign(dx) || 0, y: Math.sign(dy) || 0 }
    const speed = 3.6
    const nx = p.x + dx * speed * dt
    const ny = p.y + dy * speed * dt
    if (game.world.walkable(Math.floor(nx), Math.floor(p.y))) p.x = nx
    if (game.world.walkable(Math.floor(p.x), Math.floor(ny))) p.y = ny
    // keep inside map soft bounds
    p.x = Math.max(0.3, Math.min(p.x, 31.7))
    p.y = Math.max(0.3, Math.min(p.y, 23.7))
    p.anim += dt
  }
  if (p.bump > 0) p.bump = Math.max(0, p.bump - dt * 4)
}

function loop(now) {
  if (!game.running) return
  const dt = Math.min(0.05, (now - game.last) / 1000)
  game.last = now

  if (!game.paused) {
    movePlayer(dt)
    // time passes: 1 real second = 1 in-game minute * 0.75 pace
    game.timeAcc += dt
    while (game.timeAcc >= 0.75) {
      game.timeAcc -= 0.75
      game.player.minutes += 1
      if (game.player.minutes >= 24 * 60) game.player.minutes = 2 * 60
      // auto pass out at 2am
      if (game.player.minutes === 2 * 60) {
        toast('太晚了，你昏倒在床上……')
        sleep()
      }
    }
    if (input.usePressed) {
      input.usePressed = false
      tryUseTool()
    }
    if (game.toastTimer > 0) {
      game.toastTimer -= dt
      if (game.toastTimer <= 0) ui.toast.classList.remove('show')
    }
    updateHUD()
  }

  renderer.update(dt)
  renderer.draw(game.world, game.player, game.player.minutes)
  requestAnimationFrame(loop)
}

// input
const keyMap = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) {
    /* still track movement */
  }
  const dir = keyMap[e.code]
  if (dir) input[dir] = true

  if (e.code === 'Space') {
    e.preventDefault()
    if (!game.paused && game.running) input.usePressed = true
  }

  if (e.code >= 'Digit1' && e.code <= 'Digit8') {
    const i = Number(e.code.slice(5)) - 1
    if (game.player) {
      game.player.selected = i
      updateHUD()
    }
  }

  if (e.code === 'KeyE' && game.running) {
    if (!ui.shop.classList.contains('hidden')) closeShop()
    else if (!game.paused && game.player.nearShop(game.world)) openShop()
    else if (!game.paused) {
      toast('走到右上角杂货店门口再按 E')
      audio.play('error')
    }
  }

  if (e.code === 'Enter' && game.running && !game.paused) {
    if (game.player.nearBed(game.world)) sleep()
    else {
      toast('走到农舍床边再按 Enter 睡觉')
      audio.play('error')
    }
  }

  if (e.code === 'Escape' && game.running) {
    if (!ui.shop.classList.contains('hidden')) closeShop()
    else if (!ui.sleep.classList.contains('hidden')) wake()
    else {
      game.paused = true
      ui.menu.classList.remove('hidden')
      save()
    }
  }
})

window.addEventListener('keyup', (e) => {
  const dir = keyMap[e.code]
  if (dir) input[dir] = false
})

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0 && game.running && !game.paused) {
    audio.ensure()
    // face toward click
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const wx = (mx + renderer.camX) / renderer.tile
    const wy = (my + renderer.camY) / renderer.tile
    const dx = wx - game.player.x
    const dy = wy - game.player.y
    if (Math.abs(dx) > Math.abs(dy)) game.player.facing = { x: Math.sign(dx), y: 0 }
    else game.player.facing = { x: 0, y: Math.sign(dy) || 1 }
    input.usePressed = true
  }
})

ui.btnPlay.addEventListener('click', () => startPlaying(false))
ui.btnContinue.addEventListener('click', () => startPlaying(true))
ui.btnReset.addEventListener('click', () => {
  clearSave()
  toast('存档已清除')
  ui.btnContinue.style.display = 'none'
})
ui.btnCloseShop.addEventListener('click', closeShop)
ui.btnSellAll.addEventListener('click', () => {
  const { earned, count } = game.player.sellAllCrops()
  if (count === 0) {
    toast('背包里没有可卖的作物')
    audio.play('error')
  } else {
    toast(`卖出 ${count} 件，收入 ${earned} G`)
    audio.play('coin')
    updateHUD()
    save()
  }
})
ui.btnWake.addEventListener('click', wake)

window.addEventListener('resize', () => renderer.resize())
renderer.resize()

// preview world on menu
freshGame()
renderer.draw(game.world, game.player, game.player.minutes)
ui.btnContinue.style.display = hasSave() ? '' : 'none'
updateHUD()

// expose for smoke tests
window.__READY = true
window.game = {
  get world() {
    return game.world
  },
  get player() {
    return game.player
  },
  get running() {
    return game.running
  },
  forceRun() {
    if (!game.running) startPlaying(false)
    ui.menu.classList.add('hidden')
    game.paused = false
  },
  save,
  load,
  sleep,
  openShop,
  closeShop,
  tryUseTool,
  input,
  TILE,
}

// idle menu animation
;(function menuLoop(now) {
  if (!game.running) {
    const dt = 0.016
    if (game.player) {
      game.player.anim += dt
      game.player.minutes = 10 * 60
      renderer.update(dt)
      renderer.draw(game.world, game.player, game.player.minutes)
    }
    requestAnimationFrame(menuLoop)
  }
})()
