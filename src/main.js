// Minecraft 网页复刻:主循环 / 输入 / 昼夜 / 云 / HUD / 存档
import * as THREE from 'three'
import { buildAtlas } from './textures.js'
import { World, BLOCK, BLOCK_NAME, CHUNK, HEIGHT, SEA } from './world.js'
import { Player, EYE, raycastVoxel } from './player.js'

const MESH_RADIUS = 4
const DAY_LENGTH = 240 // 秒
const REACH = 5
const SAVE_KEY = 'minecraft-web-save-v1'

// ---------- 渲染基础 ----------
const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
document.getElementById('app').appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400)
camera.rotation.order = 'YXZ'

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ---------- 材质与世界 ----------
const atlas = buildAtlas()
// 面朝向明暗与 AO 都烘焙进顶点色,MeshBasicMaterial 最接近经典 MC 渲染
const materials = {
  opaque: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }),
  cutout: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.4 }),
  water: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false }),
}

let save = null
try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) } catch { /* 损坏则忽略 */ }
const seed = save?.seed ?? ((Math.random() * 1e9) | 0)

const world = new World(seed, materials, atlas.uvRect, scene)
if (save?.edits) for (const [k, v] of Object.entries(save.edits)) world.edits.set(k, v)

const player = new Player(world)

// 出生点:找一块海平面以上的草地
{
  let sx = 8, sz = 8
  for (let i = 0; i < 64; i++) {
    if (world.terrainHeight(sx, sz) > SEA + 1) break
    sx += 16
  }
  player.pos.set(sx + 0.5, 50, sz + 0.5)
  // 首屏同步生成脚下 chunk,避免出生即坠落
  world.update(player.pos.x, player.pos.z, 1, 99)
  // 从上往下找第一个实体方块(可能是树顶),站上去
  for (let y = HEIGHT - 1; y > 0; y--) {
    if (world.getBlock(sx, y, sz) !== BLOCK.AIR && world.getBlock(sx, y, sz) !== BLOCK.WATER) {
      player.pos.y = y + 1.01
      break
    }
  }
}

// ---------- 天空 / 太阳 / 月亮 / 云 ----------
const skyDay = new THREE.Color(0x87ceeb)
const skyNight = new THREE.Color(0x070b1a)
const fogDay = new THREE.Color(0xc7e4f5)
const fogNight = new THREE.Color(0x0a0e1e)
scene.fog = new THREE.Fog(0xc7e4f5, 24, MESH_RADIUS * CHUNK - 4)

const sun = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ color: 0xfdf4b8, fog: false }))
const moon = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: 0xd8dee8, fog: false }))
scene.add(sun, moon)

const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false })
const clouds = []
{
  const rand = () => Math.random()
  for (let i = 0; i < 34; i++) {
    const w = 14 + rand() * 26, d = 10 + rand() * 20
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), cloudMat)
    m.rotation.x = -Math.PI / 2
    m.userData.base = [rand() * 400 - 200, rand() * 400 - 200]
    scene.add(m)
    clouds.push(m)
  }
}

// 选中方块高亮框
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 }),
)
highlight.visible = false
scene.add(highlight)

// ---------- 输入 ----------
const input = { forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false }
let locked = false
let lastSpace = 0

const menu = document.getElementById('menu')
const canvas = renderer.domElement

document.getElementById('play').addEventListener('click', () => canvas.requestPointerLock())
document.getElementById('reset').addEventListener('click', () => {
  localStorage.removeItem(SAVE_KEY)
  location.reload()
})
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas
  menu.classList.toggle('hidden', locked)
})
canvas.addEventListener('click', () => { if (!locked) canvas.requestPointerLock() })

document.addEventListener('mousemove', (e) => {
  if (!locked) return
  player.yaw -= e.movementX * 0.0022
  player.pitch -= e.movementY * 0.0022
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch))
})

const KEYMAP = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  Space: 'jump', ShiftLeft: 'sneak', ShiftRight: 'sneak',
  ControlLeft: 'sprint', ControlRight: 'sprint',
}
document.addEventListener('keydown', (e) => {
  if (e.code === 'F3') { e.preventDefault(); debugEl.style.display = debugEl.style.display === 'block' ? 'none' : 'block'; return }
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5)
    if (n >= 1 && n <= HOTBAR.length) selectSlot(n - 1)
  }
  const k = KEYMAP[e.code]
  if (!k) return
  e.preventDefault()
  if (e.code === 'Space' && !e.repeat) {
    const now = performance.now()
    if (now - lastSpace < 280) { player.flying = !player.flying; player.vel.y = 0 }
    lastSpace = now
  }
  input[k] = true
})
document.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false })

// ---------- 快捷栏 ----------
const HOTBAR = [BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLE, BLOCK.PLANKS, BLOCK.LOG, BLOCK.LEAVES, BLOCK.SAND, BLOCK.GLASS]
let slot = 0
const hotbarEl = document.getElementById('hotbar')
const blocknameEl = document.getElementById('blockname')
const debugEl = document.getElementById('debug')

function buildHotbar() {
  const sideTile = { [BLOCK.GRASS]: 1, [BLOCK.DIRT]: 2, [BLOCK.STONE]: 3, [BLOCK.COBBLE]: 9, [BLOCK.PLANKS]: 8, [BLOCK.LOG]: 5, [BLOCK.LEAVES]: 7, [BLOCK.SAND]: 4, [BLOCK.GLASS]: 10 }
  HOTBAR.forEach((id, i) => {
    const div = document.createElement('div')
    div.className = 'slot'
    const c = document.createElement('canvas')
    c.width = 16; c.height = 16
    const ctx = c.getContext('2d')
    if (id === BLOCK.GLASS) { ctx.fillStyle = 'rgba(140,180,210,0.35)'; ctx.fillRect(0, 0, 16, 16) }
    ctx.drawImage(atlas.tiles[sideTile[id]], 0, 0)
    const num = document.createElement('span')
    num.className = 'num'; num.textContent = i + 1
    div.appendChild(num); div.appendChild(c)
    hotbarEl.appendChild(div)
  })
  selectSlot(0)
}
let nameTimer = null
function selectSlot(i) {
  slot = i
  ;[...hotbarEl.children].forEach((el, j) => el.classList.toggle('selected', j === i))
  blocknameEl.textContent = BLOCK_NAME[HOTBAR[i]]
  blocknameEl.style.opacity = 1
  clearTimeout(nameTimer)
  nameTimer = setTimeout(() => { blocknameEl.style.opacity = 0 }, 1400)
}
buildHotbar()
document.addEventListener('wheel', (e) => {
  if (!locked) return
  selectSlot(((slot + (e.deltaY > 0 ? 1 : -1)) % HOTBAR.length + HOTBAR.length) % HOTBAR.length)
})

// ---------- 音效(WebAudio 简易合成) ----------
let actx = null
function sfx(freq, dur, type = 'square', vol = 0.12) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)()
    const o = actx.createOscillator(), g = actx.createGain()
    o.type = type; o.frequency.value = freq
    g.gain.setValueAtTime(vol, actx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur)
    o.connect(g).connect(actx.destination)
    o.start(); o.stop(actx.currentTime + dur)
  } catch { /* 无音频环境 */ }
}

// ---------- 挖 / 放 ----------
const mouse = { left: false, right: false, lastAct: 0 }
canvas.addEventListener('mousedown', (e) => {
  if (!locked) return
  if (e.button === 0) { mouse.left = true; act(true) }
  if (e.button === 2) { mouse.right = true; act(false) }
})
canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.left = false
  if (e.button === 2) mouse.right = false
})
canvas.addEventListener('contextmenu', (e) => e.preventDefault())

function currentHit() {
  return raycastVoxel(world, player.eyePos(), player.lookDir(), REACH)
}

function breakBlock() {
  const hit = currentHit()
  if (!hit || hit.id === BLOCK.BEDROCK) return false
  world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR)
  sfx(90 + Math.random() * 40, 0.12, 'square', 0.18)
  scheduleSave()
  return true
}

function placeBlock() {
  const hit = currentHit()
  if (!hit) return false
  const [nx, ny, nz] = hit.normal
  const x = hit.x + nx, y = hit.y + ny, z = hit.z + nz
  const target = world.getBlock(x, y, z)
  if (target !== BLOCK.AIR && target !== BLOCK.WATER) return false
  if (player.intersectsBlock(x, y, z)) return false
  world.setBlock(x, y, z, HOTBAR[slot])
  sfx(220 + Math.random() * 60, 0.08, 'triangle', 0.14)
  scheduleSave()
  return true
}

function act(isBreak) {
  mouse.lastAct = performance.now()
  return isBreak ? breakBlock() : placeBlock()
}

// ---------- 存档 ----------
let saveTimer = null
function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ seed, edits: Object.fromEntries(world.edits) }))
    } catch { /* 存储满则跳过 */ }
  }, 1500)
}

// ---------- 主循环 ----------
const clock = new THREE.Clock()
let fps = 0, fpsAcc = 0, fpsN = 0, fpsT = 0
let dayTime = DAY_LENGTH * 0.25 // 从清晨开始

function tick() {
  requestAnimationFrame(tick)
  const dt = Math.min(clock.getDelta(), 0.05)

  // 长按持续挖/放
  const now = performance.now()
  if (locked && (mouse.left || mouse.right) && now - mouse.lastAct > 240) {
    act(mouse.left)
  }

  if (locked || window.__FORCE_RUN) player.update(dt, input)

  // 相机
  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z)
  camera.rotation.set(player.pitch, player.yaw, 0)

  // chunk 流式加载
  world.update(player.pos.x, player.pos.z, MESH_RADIUS, 2)

  // 昼夜
  dayTime = (dayTime + dt) % DAY_LENGTH
  const ang = (dayTime / DAY_LENGTH) * Math.PI * 2
  const sunH = Math.sin(ang) // >0 白天
  const dayness = THREE.MathUtils.clamp(sunH * 3 + 0.5, 0, 1)
  const sky = skyNight.clone().lerp(skyDay, dayness)
  scene.background = sky
  scene.fog.color.copy(fogNight.clone().lerp(fogDay, dayness))
  const bright = 0.22 + 0.78 * dayness
  materials.opaque.color.setScalar(bright)
  materials.cutout.color.setScalar(bright)
  materials.water.color.setScalar(bright)
  cloudMat.opacity = 0.15 + 0.4 * dayness

  const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.25).normalize()
  sun.position.copy(camera.position).addScaledVector(sunDir, 320)
  sun.lookAt(camera.position)
  moon.position.copy(camera.position).addScaledVector(sunDir, -320)
  moon.lookAt(camera.position)

  // 云:绕玩家 400 格环绕漂移
  const drift = performance.now() * 0.001 * 1.5
  for (const m of clouds) {
    const [bx, bz] = m.userData.base
    const rx = ((bx + drift - player.pos.x) % 400 + 600) % 400 - 200
    const rz = ((bz - player.pos.z) % 400 + 600) % 400 - 200
    m.position.set(player.pos.x + rx, HEIGHT + 8 + (bx % 5), player.pos.z + rz)
  }

  // 准星指向的方块高亮
  const hit = currentHit()
  if (hit) {
    highlight.visible = true
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
  } else highlight.visible = false

  renderer.render(scene, camera)

  // FPS / 调试
  fpsAcc += dt; fpsN++
  if ((fpsT += dt) > 0.5) {
    fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; fpsT = 0
  }
  if (debugEl.style.display === 'block') {
    debugEl.textContent =
      `Minecraft 网页版 (${fps} fps)\n` +
      `XYZ: ${player.pos.x.toFixed(1)} / ${player.pos.y.toFixed(1)} / ${player.pos.z.toFixed(1)}\n` +
      `Chunk: ${Math.floor(player.pos.x / CHUNK)}, ${Math.floor(player.pos.z / CHUNK)} (已建网格 ${world.meshCount()})\n` +
      `时间: ${(dayTime / DAY_LENGTH * 24).toFixed(1)}h  种子: ${seed}\n` +
      `${player.flying ? '飞行中' : player.inWater ? '水中' : player.onGround ? '地面' : '空中'}`
  }

  window.__READY = true
}
tick()

// ---------- 测试 API(无头冒烟用) ----------
window.game = {
  world, player, input,
  get fps() { return fps },
  breakBlock, placeBlock, selectSlot, hit: currentHit,
  forceRun() { window.__FORCE_RUN = true; menu.classList.add('hidden') },
  setDayTime(t) { dayTime = t * DAY_LENGTH },
}
