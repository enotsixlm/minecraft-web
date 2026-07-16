// 体素世界:分块数据生成(地形/洞穴/树)+ 网格构建(面剔除 + 面明暗 + AO)
import * as THREE from 'three'
import { fbm2, noise3, hash2, mulberry32 } from './noise.js'
import { TEX } from './textures.js'

export const CHUNK = 16
export const HEIGHT = 64
export const SEA = 28

export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  LOG: 6, LEAVES: 7, PLANKS: 8, COBBLE: 9, GLASS: 10, BEDROCK: 11,
}

export const BLOCK_NAME = {
  [BLOCK.GRASS]: '草方块', [BLOCK.DIRT]: '泥土', [BLOCK.STONE]: '石头',
  [BLOCK.SAND]: '沙子', [BLOCK.WATER]: '水', [BLOCK.LOG]: '橡木原木',
  [BLOCK.LEAVES]: '橡树树叶', [BLOCK.PLANKS]: '橡木木板',
  [BLOCK.COBBLE]: '圆石', [BLOCK.GLASS]: '玻璃', [BLOCK.BEDROCK]: '基岩',
}

// [顶, 底, 侧] 贴图瓦片
const TILES = {
  [BLOCK.GRASS]: [TEX.GRASS_TOP, TEX.DIRT, TEX.GRASS_SIDE],
  [BLOCK.DIRT]: [TEX.DIRT, TEX.DIRT, TEX.DIRT],
  [BLOCK.STONE]: [TEX.STONE, TEX.STONE, TEX.STONE],
  [BLOCK.SAND]: [TEX.SAND, TEX.SAND, TEX.SAND],
  [BLOCK.WATER]: [TEX.WATER, TEX.WATER, TEX.WATER],
  [BLOCK.LOG]: [TEX.LOG_TOP, TEX.LOG_TOP, TEX.LOG_SIDE],
  [BLOCK.LEAVES]: [TEX.LEAVES, TEX.LEAVES, TEX.LEAVES],
  [BLOCK.PLANKS]: [TEX.PLANKS, TEX.PLANKS, TEX.PLANKS],
  [BLOCK.COBBLE]: [TEX.COBBLE, TEX.COBBLE, TEX.COBBLE],
  [BLOCK.GLASS]: [TEX.GLASS, TEX.GLASS, TEX.GLASS],
  [BLOCK.BEDROCK]: [TEX.BEDROCK, TEX.BEDROCK, TEX.BEDROCK],
}

export const isSolid = (id) => id !== BLOCK.AIR && id !== BLOCK.WATER
export const isOpaque = (id) => id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.GLASS

// 六个面:方向、四角(0/1)、面明暗(还原 MC 各朝向亮度差)、瓦片选择(0顶 1底 2侧)
const FACES = [
  { dir: [0, 1, 0], tile: 0, shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { dir: [0, -1, 0], tile: 1, shade: 0.5, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { dir: [1, 0, 0], tile: 2, shade: 0.6, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { dir: [-1, 0, 0], tile: 2, shade: 0.6, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { dir: [0, 0, 1], tile: 2, shade: 0.8, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { dir: [0, 0, -1], tile: 2, shade: 0.8, corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
]

const key = (cx, cz) => cx + ',' + cz

export class World {
  constructor(seed, materials, uvRect, scene) {
    this.seed = seed
    this.materials = materials // { opaque, cutout, water }
    this.uvRect = uvRect
    this.scene = scene
    this.chunks = new Map()
    this.edits = new Map() // "x,y,z" -> id,用于存档
  }

  terrainHeight(x, z) {
    const continental = fbm2(x * 0.0035, z * 0.0035, 3, this.seed) * 15
    const hills = fbm2(x * 0.016 + 500, z * 0.016 + 500, 4, this.seed + 7) * 7
    let h = 30 + continental + hills
    return Math.max(4, Math.min(HEIGHT - 14, Math.floor(h)))
  }

  ensureChunkData(cx, cz) {
    const k = key(cx, cz)
    let c = this.chunks.get(k)
    if (c) return c
    c = { cx, cz, data: new Uint8Array(CHUNK * HEIGHT * CHUNK), meshes: null, dirty: false }
    this.genChunkData(c)
    this.chunks.set(k, c)
    return c
  }

  idx(lx, y, lz) { return (y * CHUNK + lz) * CHUNK + lx }

  genChunkData(c) {
    const { data, cx, cz } = c
    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz
        const h = this.terrainHeight(wx, wz)
        const sandy = h <= SEA + 1
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id = BLOCK.AIR
          if (y === 0) id = BLOCK.BEDROCK
          else if (y > h) id = y <= SEA ? BLOCK.WATER : BLOCK.AIR
          else if (y === h) id = sandy ? BLOCK.SAND : BLOCK.GRASS
          else if (y >= h - 3) id = sandy ? BLOCK.SAND : BLOCK.DIRT
          else id = BLOCK.STONE
          // 洞穴:仅在不邻海的柱子里挖,避免漏水
          if (id === BLOCK.STONE && h > SEA + 1 && y > 3 &&
            noise3(wx * 0.09, y * 0.09, wz * 0.09, this.seed + 99) > 0.62) id = BLOCK.AIR
          data[this.idx(lx, y, lz)] = id
        }
      }
    }
    // 树:整棵落在本 chunk 内,跨界省略
    const rand = mulberry32((hash2(cx, cz, this.seed + 555) * 1e9) | 0)
    const attempts = 2 + (rand() * 3 | 0)
    for (let i = 0; i < attempts; i++) {
      const lx = 2 + (rand() * 12 | 0), lz = 2 + (rand() * 12 | 0)
      const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz
      const h = this.terrainHeight(wx, wz)
      if (data[this.idx(lx, h, lz)] !== BLOCK.GRASS) continue
      const th = 4 + (rand() * 2 | 0)
      if (h + th + 2 >= HEIGHT) continue
      for (let t = 1; t <= th; t++) data[this.idx(lx, h + t, lz)] = BLOCK.LOG
      for (let dy = th - 2; dy <= th + 1; dy++) {
        const r = dy >= th ? 1 : 2
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy <= th) continue
          if (Math.abs(dx) === r && Math.abs(dz) === r && rand() > 0.4) continue
          const i2 = this.idx(lx + dx, h + dy, lz + dz)
          if (data[i2] === BLOCK.AIR) data[i2] = BLOCK.LEAVES
        }
      }
      data[this.idx(lx, h + th + 1, lz)] = BLOCK.LEAVES
    }
    // 应用玩家存档修改
    for (const [pk, id] of this.edits) {
      const [x, y, z] = pk.split(',').map(Number)
      if (Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz) {
        data[this.idx(x - cx * CHUNK, y, z - cz * CHUNK)] = id
      }
    }
  }

  getBlock(x, y, z) {
    if (y < 0) return BLOCK.BEDROCK
    if (y >= HEIGHT) return BLOCK.AIR
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK)
    const c = this.chunks.get(key(cx, cz))
    if (!c) return BLOCK.AIR
    return c.data[this.idx(x - cx * CHUNK, y, z - cz * CHUNK)]
  }

  setBlock(x, y, z, id, record = true) {
    if (y < 1 || y >= HEIGHT) return false
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK)
    const c = this.chunks.get(key(cx, cz))
    if (!c) return false
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK
    c.data[this.idx(lx, y, lz)] = id
    if (record) this.edits.set(x + ',' + y + ',' + z, id)
    c.dirty = true
    // 边界方块要连带重建相邻 chunk
    if (lx === 0) this.markDirty(cx - 1, cz)
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz)
    if (lz === 0) this.markDirty(cx, cz - 1)
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1)
    return true
  }

  markDirty(cx, cz) {
    const c = this.chunks.get(key(cx, cz))
    if (c && c.meshes) c.dirty = true
  }

  disposeMeshes(c) {
    if (!c.meshes) return
    for (const m of c.meshes) {
      this.scene.remove(m)
      m.geometry.dispose()
    }
    c.meshes = null
  }

  // 一个顶点的 AO:贴脸外侧的 side1/side2/corner 三块遮挡
  vertexAO(x, y, z, dir, corner) {
    const ox = x + dir[0], oy = y + dir[1], oz = z + dir[2]
    const axes = []
    for (let a = 0; a < 3; a++) if (dir[a] === 0) axes.push(a)
    const s = [0, 0, 0], t = [0, 0, 0]
    s[axes[0]] = corner[axes[0]] * 2 - 1
    t[axes[1]] = corner[axes[1]] * 2 - 1
    const s1 = isOpaque(this.getBlock(ox + s[0], oy + s[1], oz + s[2])) ? 1 : 0
    const s2 = isOpaque(this.getBlock(ox + t[0], oy + t[1], oz + t[2])) ? 1 : 0
    const cc = isOpaque(this.getBlock(ox + s[0] + t[0], oy + s[1] + t[1], oz + s[2] + t[2])) ? 1 : 0
    const level = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc)
    return 0.55 + 0.15 * level
  }

  buildChunkMeshes(c) {
    this.disposeMeshes(c)
    // 三个渲染桶:不透明 / 镂空(玻璃) / 水
    const buckets = [
      { pos: [], nor: [], uv: [], col: [], idx: [], mat: this.materials.opaque },
      { pos: [], nor: [], uv: [], col: [], idx: [], mat: this.materials.cutout },
      { pos: [], nor: [], uv: [], col: [], idx: [], mat: this.materials.water },
    ]
    const { data, cx, cz } = c
    for (let y = 0; y < HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const id = data[this.idx(lx, y, lz)]
          if (!id) continue
          const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz
          const b = buckets[id === BLOCK.WATER ? 2 : id === BLOCK.GLASS ? 1 : 0]
          const waterTopLow = id === BLOCK.WATER && this.getBlock(wx, y + 1, wz) !== BLOCK.WATER
          for (const f of FACES) {
            const n = this.getBlock(wx + f.dir[0], y + f.dir[1], wz + f.dir[2])
            if (n === id || isOpaque(n)) continue
            if (id === BLOCK.WATER && isSolid(n)) continue
            const [u0, v0, u1, v1] = this.uvRect(TILES[id][f.tile])
            const base = b.pos.length / 3
            const aos = []
            for (let ci = 0; ci < 4; ci++) {
              const co = f.corners[ci]
              let cy = y + co[1]
              if (waterTopLow && co[1] === 1) cy = y + 0.875
              b.pos.push(wx + co[0], cy, wz + co[2])
              b.nor.push(f.dir[0], f.dir[1], f.dir[2])
              const [uu, vv] = f.uvs[ci]
              b.uv.push(u0 + (u1 - u0) * uu, v0 + (v1 - v0) * vv)
              const ao = id === BLOCK.WATER ? 1 : this.vertexAO(wx, y, wz, f.dir, co)
              aos.push(ao)
              const l = f.shade * ao
              b.col.push(l, l, l)
            }
            // AO 对角翻转,避免四边形插值走样
            if (aos[0] + aos[2] >= aos[1] + aos[3]) {
              b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
            } else {
              b.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base)
            }
          }
        }
      }
    }
    c.meshes = []
    for (const b of buckets) {
      if (!b.idx.length) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2))
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3))
      g.setIndex(b.idx)
      const m = new THREE.Mesh(g, b.mat)
      m.frustumCulled = true
      this.scene.add(m)
      c.meshes.push(m)
    }
    c.dirty = false
  }

  // 保证玩家周围 chunk 数据与网格,返回是否有工作剩余
  update(px, pz, meshRadius, budget = 2) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK)
    const dataR = meshRadius + 1
    for (let dx = -dataR; dx <= dataR; dx++)
      for (let dz = -dataR; dz <= dataR; dz++)
        this.ensureChunkData(pcx + dx, pcz + dz)

    // 卸载远处网格
    for (const c of this.chunks.values()) {
      if (c.meshes && (Math.abs(c.cx - pcx) > meshRadius + 1 || Math.abs(c.cz - pcz) > meshRadius + 1)) {
        this.disposeMeshes(c)
      }
    }
    // 由近到远建网格,每帧限量
    let built = 0
    const order = []
    for (let dx = -meshRadius; dx <= meshRadius; dx++)
      for (let dz = -meshRadius; dz <= meshRadius; dz++)
        order.push([dx * dx + dz * dz, pcx + dx, pcz + dz])
    order.sort((a, b2) => a[0] - b2[0])
    for (const [, cx, cz] of order) {
      const c = this.chunks.get(key(cx, cz))
      if (!c) continue
      if (!c.meshes || c.dirty) {
        this.buildChunkMeshes(c)
        if (++built >= budget) return true
      }
    }
    return false
  }

  meshCount() {
    let n = 0
    for (const c of this.chunks.values()) if (c.meshes) n++
    return n
  }
}
