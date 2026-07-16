// 确定性噪声工具:种子哈希 + 值噪声(2D/3D) + fbm

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash2(ix, iz, seed) {
  let h = seed | 0
  h = Math.imul(h ^ ix, 0x27d4eb2d)
  h = Math.imul(h ^ iz, 0x165667b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

function hash3(ix, iy, iz, seed) {
  let h = seed | 0
  h = Math.imul(h ^ ix, 0x27d4eb2d)
  h = Math.imul(h ^ iy, 0x9e3779b1)
  h = Math.imul(h ^ iz, 0x165667b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

const smooth = (t) => t * t * (3 - 2 * t)
const lerp = (a, b, t) => a + (b - a) * t

// 值噪声,返回 [-1, 1]
export function noise2(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = smooth(x - ix), fz = smooth(z - iz)
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed)
  return (lerp(lerp(a, b, fx), lerp(c, d, fx), fz)) * 2 - 1
}

export function noise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz)
  const c000 = hash3(ix, iy, iz, seed), c100 = hash3(ix + 1, iy, iz, seed)
  const c010 = hash3(ix, iy + 1, iz, seed), c110 = hash3(ix + 1, iy + 1, iz, seed)
  const c001 = hash3(ix, iy, iz + 1, seed), c101 = hash3(ix + 1, iy, iz + 1, seed)
  const c011 = hash3(ix, iy + 1, iz + 1, seed), c111 = hash3(ix + 1, iy + 1, iz + 1, seed)
  const x00 = lerp(c000, c100, fx), x10 = lerp(c010, c110, fx)
  const x01 = lerp(c001, c101, fx), x11 = lerp(c011, c111, fx)
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz) * 2 - 1
}

export function fbm2(x, z, octaves, seed) {
  let sum = 0, amp = 1, freq = 1, norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, z * freq, seed + i * 1013) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}
