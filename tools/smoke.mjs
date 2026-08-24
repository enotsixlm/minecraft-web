// 无头冒烟测试:加载、移动、耕地/浇水/种植、睡觉过天、截图
import { spawn } from 'node:child_process'
import { mkdirSync, existsSync, readdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(root, 'shots'), { recursive: true })

const PORT = 5197
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' })
await new Promise((res, rej) => {
  vite.stdout.on('data', (d) => { if (String(d).includes('Local:')) res() })
  vite.stderr.on('data', (d) => process.stderr.write(d))
  vite.on('exit', (c) => rej(new Error('vite exited ' + c)))
  setTimeout(() => rej(new Error('vite start timeout')), 20000)
})

function findChrome() {
  const home = homedir()
  const candidates = [
    join(home, 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
    join(home, '.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell'),
    join(home, '.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell'),
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ]
  const cache = join(home, '.cache/ms-playwright')
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache)) {
      if (!dir.startsWith('chromium_headless_shell')) continue
      const p = join(cache, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell')
      candidates.unshift(p)
    }
  }
  return candidates.find((p) => existsSync(p))
}

const shell = findChrome()
if (!shell) {
  console.error('No chromium found')
  vite.kill()
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: shell, args: ['--enable-unsafe-swiftshader'] })
let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed++
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForFunction('window.__READY === true', null, { timeout: 30000 })
  await page.evaluate('game.forceRun()')
  await page.waitForTimeout(800)

  check('页面加载且游戏可启动', true)
  check('无 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '))

  const tile = await page.evaluate(`(() => {
    const p = game.player
    return game.world.get(Math.floor(p.x), Math.floor(p.y))
  })()`)
  check('出生点在可站立地块', tile !== 4, `tile=${tile}`)

  await page.screenshot({ path: join(root, 'shots/day.png') })

  // 移动
  const p0 = await page.evaluate('({ x: game.player.x, y: game.player.y })')
  await page.evaluate('Object.assign(game.input, { right: true })')
  await page.waitForTimeout(900)
  await page.evaluate('Object.assign(game.input, { right: false })')
  const p1 = await page.evaluate('({ x: game.player.x, y: game.player.y })')
  const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  check('WASD 移动', dist > 0.8, `位移 ${dist.toFixed(2)}`)

  // 耕地 + 浇水 + 种植
  const farm = await page.evaluate(`(() => {
    const p = game.player
    // 站到农田里
    p.x = 10.5
    p.y = 10.5
    p.facing = { x: 0, y: 1 }
    p.selected = 0 // hoe
    const tx = 10, ty = 11
    game.world.set(tx, ty, game.TILE.DIRT)
    game.tryUseTool()
    const afterTill = game.world.get(tx, ty)
    p.selected = 1 // can
    game.tryUseTool()
    const afterWater = game.world.get(tx, ty)
    p.selected = 3 // parsnip seeds
    // ensure seed slot
    const slot = game.player.inventory[3]
    game.tryUseTool()
    const crop = game.world.getCrop(tx, ty)
    return { afterTill, afterWater, cropId: crop && crop.cropId, slotKind: slot && slot.kind, TILE: { TILLED: 2, WATERED: 3 } }
  })()`)
  check('锄头耕地', farm.afterTill === farm.TILE.TILLED || farm.afterTill === farm.TILE.WATERED, `tile=${farm.afterTill}`)
  check('喷壶浇水', farm.afterWater === farm.TILE.WATERED, `tile=${farm.afterWater}`)
  check('播种防风草', farm.cropId === 'parsnip', `crop=${farm.cropId}`)

  // 睡觉过天
  const day0 = await page.evaluate('game.player.day')
  await page.evaluate('game.sleep()')
  await page.waitForTimeout(200)
  const day1 = await page.evaluate('game.player.day')
  check('睡觉过天', day1 === day0 + 1, `day ${day0} -> ${day1}`)

  await page.screenshot({ path: join(root, 'shots/night.png') })

  // 存档
  const saved = await page.evaluate(`(() => {
    game.save()
    const gold = game.player.gold
    game.player.gold = 0
    game.load()
    return game.player.gold === gold
  })()`)
  check('存档读写', saved)

  console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`)
} finally {
  await browser.close()
  vite.kill()
}
process.exit(failed ? 1 : 0)
