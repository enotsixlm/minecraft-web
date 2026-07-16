// 程序生成经典 16x16 像素方块贴图,拼成 4x4 图集
import * as THREE from 'three'
import { mulberry32 } from './noise.js'

const TILE = 16
const COLS = 4
const ROWS = 4

// 图集里的瓦片编号
export const TEX = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3,
  SAND: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7,
  PLANKS: 8, COBBLE: 9, GLASS: 10, WATER: 11,
  BEDROCK: 12,
}

function makeTileCanvas(paint) {
  const c = document.createElement('canvas')
  c.width = TILE; c.height = TILE
  const ctx = c.getContext('2d')
  paint(ctx)
  return c
}

const px = (ctx, x, y, r, g, b, a = 1) => {
  ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`
  ctx.fillRect(x, y, 1, 1)
}

// 底色 + 每像素随机明暗抖动,MC 贴图的基本质感
function noisy(ctx, rand, [r, g, b], vary) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const v = (rand() * 2 - 1) * vary
    px(ctx, x, y, r + v, g + v, b + v)
  }
}

export function buildAtlas() {
  const painters = []

  painters[TEX.GRASS_TOP] = (ctx) => {
    const rand = mulberry32(101)
    noisy(ctx, rand, [110, 172, 70], 18)
    for (let i = 0; i < 30; i++) px(ctx, rand() * 16 | 0, rand() * 16 | 0, 88, 148, 52)
  }
  painters[TEX.DIRT] = (ctx) => {
    const rand = mulberry32(102)
    noisy(ctx, rand, [134, 96, 67], 16)
    for (let i = 0; i < 14; i++) px(ctx, rand() * 16 | 0, rand() * 16 | 0, 104, 74, 50)
  }
  painters[TEX.GRASS_SIDE] = (ctx) => {
    painters[TEX.DIRT](ctx)
    const rand = mulberry32(103)
    for (let x = 0; x < TILE; x++) {
      const depth = 2 + (rand() * 2.4 | 0)
      for (let y = 0; y < depth; y++) {
        const v = (rand() * 2 - 1) * 16
        px(ctx, x, y, 110 + v, 172 + v, 70 + v)
      }
    }
  }
  painters[TEX.STONE] = (ctx) => {
    const rand = mulberry32(104)
    noisy(ctx, rand, [127, 127, 127], 12)
    for (let i = 0; i < 10; i++) {
      const x = rand() * 14 | 0, y = rand() * 15 | 0
      px(ctx, x, y, 105, 105, 105); px(ctx, x + 1, y, 112, 112, 112)
    }
  }
  painters[TEX.SAND] = (ctx) => {
    const rand = mulberry32(105)
    noisy(ctx, rand, [219, 207, 163], 12)
  }
  painters[TEX.LOG_SIDE] = (ctx) => {
    const rand = mulberry32(106)
    for (let x = 0; x < TILE; x++) {
      const dark = (x % 4 === 0 || x % 7 === 0)
      for (let y = 0; y < TILE; y++) {
        const v = (rand() * 2 - 1) * 10
        if (dark) px(ctx, x, y, 76 + v, 60 + v, 36 + v)
        else px(ctx, x, y, 104 + v, 82 + v, 49 + v)
      }
    }
  }
  painters[TEX.LOG_TOP] = (ctx) => {
    const rand = mulberry32(107)
    noisy(ctx, rand, [104, 82, 49], 8)
    ctx.fillStyle = 'rgb(178,142,90)'
    ctx.fillRect(2, 2, 12, 12)
    ctx.fillStyle = 'rgb(150,118,70)'
    ctx.fillRect(4, 4, 8, 8)
    ctx.fillStyle = 'rgb(178,142,90)'
    ctx.fillRect(6, 6, 4, 4)
    for (let i = 0; i < 12; i++) px(ctx, 2 + rand() * 12 | 0, 2 + rand() * 12 | 0, 130, 102, 60)
  }
  painters[TEX.LEAVES] = (ctx) => {
    const rand = mulberry32(108)
    noisy(ctx, rand, [56, 118, 30], 20)
    for (let i = 0; i < 26; i++) px(ctx, rand() * 16 | 0, rand() * 16 | 0, 36, 84, 18)
    for (let i = 0; i < 10; i++) px(ctx, rand() * 16 | 0, rand() * 16 | 0, 74, 140, 42)
  }
  painters[TEX.PLANKS] = (ctx) => {
    const rand = mulberry32(109)
    noisy(ctx, rand, [162, 130, 78], 10)
    ctx.fillStyle = 'rgb(120,94,54)'
    for (const y of [3, 7, 11, 15]) ctx.fillRect(0, y, 16, 1)
    ctx.fillRect(8, 0, 1, 4); ctx.fillRect(3, 4, 1, 4)
    ctx.fillRect(11, 8, 1, 4); ctx.fillRect(5, 12, 1, 4)
  }
  painters[TEX.COBBLE] = (ctx) => {
    const rand = mulberry32(110)
    noisy(ctx, rand, [90, 90, 90], 8)
    for (let i = 0; i < 12; i++) {
      const x = rand() * 13 | 0, y = rand() * 13 | 0, s = 2 + (rand() * 3 | 0)
      const g = 110 + rand() * 40
      ctx.fillStyle = `rgb(${g | 0},${g | 0},${g | 0})`
      ctx.fillRect(x, y, s, s)
    }
  }
  painters[TEX.GLASS] = (ctx) => {
    ctx.clearRect(0, 0, 16, 16)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1)
    ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16)
    ctx.fillStyle = 'rgba(220,240,250,0.9)'
    for (let i = 0; i < 5; i++) px(ctx, 3 + i, 8 - i, 220, 240, 250, 0.9)
    for (let i = 0; i < 3; i++) px(ctx, 9 + i, 12 - i, 220, 240, 250, 0.9)
  }
  painters[TEX.WATER] = (ctx) => {
    const rand = mulberry32(112)
    noisy(ctx, rand, [56, 100, 200], 16)
    for (let i = 0; i < 8; i++) {
      const x = rand() * 14 | 0, y = rand() * 16 | 0
      px(ctx, x, y, 90, 140, 230); px(ctx, x + 1, y, 90, 140, 230)
    }
  }
  painters[TEX.BEDROCK] = (ctx) => {
    const rand = mulberry32(113)
    noisy(ctx, rand, [70, 70, 70], 30)
    for (let i = 0; i < 20; i++) {
      const x = rand() * 15 | 0, y = rand() * 15 | 0
      const g = rand() > 0.5 ? 30 : 110
      px(ctx, x, y, g, g, g); px(ctx, x + 1, y, g, g, g)
    }
  }

  const tiles = []
  const atlas = document.createElement('canvas')
  atlas.width = TILE * COLS
  atlas.height = TILE * ROWS
  const actx = atlas.getContext('2d')
  for (let i = 0; i < painters.length; i++) {
    if (!painters[i]) continue
    const t = makeTileCanvas(painters[i])
    tiles[i] = t
    actx.drawImage(t, (i % COLS) * TILE, Math.floor(i / COLS) * TILE)
  }

  const texture = new THREE.CanvasTexture(atlas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace

  // 瓦片 t 的 uv 区间(带极小 inset 防渗色)
  const uvRect = (t) => {
    const e = 0.001
    const u0 = (t % COLS) / COLS + e
    const v0 = 1 - (Math.floor(t / COLS) + 1) / ROWS + e
    return [u0, v0, u0 + 1 / COLS - 2 * e, v0 + 1 / ROWS - 2 * e]
  }

  return { texture, tiles, uvRect }
}
