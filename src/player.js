// 第一人称玩家:AABB 碰撞 + 重力跳跃 + 游泳 + 创造飞行
import * as THREE from 'three'
import { BLOCK, isSolid } from './world.js'

const HALF = 0.3       // 碰撞盒半宽
const PLAYER_H = 1.8
export const EYE = 1.62
const GRAVITY = 25
const JUMP_V = 8.6
const WALK = 4.3
const SPRINT = 5.8
const SNEAK = 1.6
const FLY = 9
const EPS = 0.001

export class Player {
  constructor(world) {
    this.world = world
    this.pos = new THREE.Vector3(8.5, 50, 8.5)
    this.vel = new THREE.Vector3()
    this.yaw = 0
    this.pitch = 0
    this.onGround = false
    this.inWater = false
    this.flying = false
  }

  eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z)
  }

  lookDir() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    )
  }

  aabbHits(px, py, pz) {
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF)
    const y0 = Math.floor(py), y1 = Math.floor(py + PLAYER_H)
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF)
    const hits = []
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (isSolid(this.world.getBlock(x, y, z))) hits.push([x, y, z])
    return hits
  }

  intersectsBlock(bx, by, bz) {
    return bx + 1 > this.pos.x - HALF && bx < this.pos.x + HALF &&
      by + 1 > this.pos.y && by < this.pos.y + PLAYER_H &&
      bz + 1 > this.pos.z - HALF && bz < this.pos.z + HALF
  }

  update(dt, input) {
    const headBlock = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 1.2), Math.floor(this.pos.z))
    const feetBlock = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z))
    this.inWater = headBlock === BLOCK.WATER || feetBlock === BLOCK.WATER

    // 水平意图方向(相对朝向)
    let mx = 0, mz = 0
    if (input.forward) mz -= 1
    if (input.back) mz += 1
    if (input.left) mx -= 1
    if (input.right) mx += 1
    const len = Math.hypot(mx, mz) || 1
    mx /= len; mz /= len
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw)
    const wx = mx * cos - mz * sin
    const wz = mz * cos + mx * sin

    let speed = input.sprint ? SPRINT : input.sneak ? SNEAK : WALK
    if (this.flying) speed = FLY
    else if (this.inWater) speed *= 0.55

    if (this.flying) {
      this.vel.x = wx * speed
      this.vel.z = wz * speed
      this.vel.y = (input.jump ? FLY : 0) + (input.sneak ? -FLY : 0)
      if (!input.jump && !input.sneak) this.vel.y = 0
    } else if (this.inWater) {
      this.vel.x = wx * speed
      this.vel.z = wz * speed
      this.vel.y = input.jump ? 3.2 : Math.max(this.vel.y - GRAVITY * 0.25 * dt, -2.2)
    } else {
      // 地面直接给速度,空中保留部分操控,手感接近 MC
      const control = this.onGround ? 1 : 0.35
      this.vel.x += (wx * speed - this.vel.x) * control
      this.vel.z += (wz * speed - this.vel.z) * control
      this.vel.y -= GRAVITY * dt
      if (this.vel.y < -40) this.vel.y = -40
      if (input.jump && this.onGround) {
        this.vel.y = JUMP_V
        this.onGround = false
      }
    }

    this.moveAxis(0, this.vel.x * dt)
    this.moveAxis(1, this.vel.y * dt)
    this.moveAxis(2, this.vel.z * dt)

    if (this.pos.y < -10) { // 掉出世界兜底
      this.pos.y = 50
      this.vel.set(0, 0, 0)
    }
  }

  moveAxis(axis, amount) {
    if (!amount) return
    const p = this.pos
    if (axis === 0) p.x += amount
    else if (axis === 1) { p.y += amount; if (amount < 0) this.onGround = false }
    else p.z += amount

    for (const [bx, by, bz] of this.aabbHits(p.x, p.y, p.z)) {
      if (axis === 0) {
        p.x = amount > 0 ? bx - HALF - EPS : bx + 1 + HALF + EPS
        this.vel.x = 0
      } else if (axis === 1) {
        if (amount > 0) { p.y = by - PLAYER_H - EPS } else { p.y = by + 1 + EPS; this.onGround = true }
        this.vel.y = 0
      } else {
        p.z = amount > 0 ? bz - HALF - EPS : bz + 1 + HALF + EPS
        this.vel.z = 0
      }
    }
  }
}

// 体素 DDA 射线:返回命中的方块与法线
export function raycastVoxel(world, origin, dir, maxDist) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z)
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1
  const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z)
  let tx = dir.x !== 0 ? Math.abs((stepX > 0 ? x + 1 - origin.x : origin.x - x)) * tdx : Infinity
  let ty = dir.y !== 0 ? Math.abs((stepY > 0 ? y + 1 - origin.y : origin.y - y)) * tdy : Infinity
  let tz = dir.z !== 0 ? Math.abs((stepZ > 0 ? z + 1 - origin.z : origin.z - z)) * tdz : Infinity
  let t = 0, normal = [0, 0, 0]
  while (t <= maxDist) {
    if (tx < ty && tx < tz) { x += stepX; t = tx; tx += tdx; normal = [-stepX, 0, 0] }
    else if (ty < tz) { y += stepY; t = ty; ty += tdy; normal = [0, -stepY, 0] }
    else { z += stepZ; t = tz; tz += tdz; normal = [0, 0, -stepZ] }
    const id = world.getBlock(x, y, z)
    if (isSolid(id)) return { x, y, z, id, normal, dist: t }
  }
  return null
}
