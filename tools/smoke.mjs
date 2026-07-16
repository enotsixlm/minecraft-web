// 无头冒烟测试:渲染、移动物理、挖/放方块、昼夜、截图
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

const shell = join(process.env.HOME, 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell')
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
  await page.waitForTimeout(1200)

  check('页面加载且渲染循环运行', true)
  check('无 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '))

  // 世界生成:脚下应有地面
  const ground = await page.evaluate(`(() => {
    const p = game.player.pos
    return game.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z))
  })()`)
  check('出生点脚下有方块', ground !== 0, `block id=${ground}`)

  const meshes = await page.evaluate('game.world.meshCount()')
  check('chunk 网格已构建', meshes >= 20, `${meshes} chunks`)

  await page.screenshot({ path: join(root, 'shots/day.png') })

  // 移动物理:前进 1.5s 应位移
  const p0 = await page.evaluate('({...game.player.pos})')
  await page.evaluate('game.input.forward = true')
  await page.waitForTimeout(1500)
  await page.evaluate('game.input.forward = false')
  const p1 = await page.evaluate('({...game.player.pos})')
  const dist = Math.hypot(p1.x - p0.x, p1.z - p0.z)
  check('WASD 移动物理', dist > 2, `位移 ${dist.toFixed(1)} 格`)

  // 挖+放:垂直向下看,同一帧内完成避免坠落干扰
  const digPlace = await page.evaluate(`(() => {
    game.player.pitch = -1.5
    const h0 = game.hit()
    if (!h0) return { err: 'no hit' }
    const before = h0.id
    const okBreak = game.breakBlock()
    const afterBreak = game.world.getBlock(h0.x, h0.y, h0.z)
    game.selectSlot(3) // 圆石
    const okPlace = game.placeBlock()
    const afterPlace = game.world.getBlock(h0.x, h0.y, h0.z)
    return { before, okBreak, afterBreak, okPlace, afterPlace }
  })()`)
  check('挖方块', digPlace.okBreak && digPlace.afterBreak === 0, `before=${digPlace.before} after=${digPlace.afterBreak} ${digPlace.err || ''}`)
  check('放方块(圆石)', digPlace.okPlace && digPlace.afterPlace === 9, `after=${digPlace.afterPlace}`)

  // 跳跃
  const jumped = await page.evaluate(`(async () => {
    game.player.pitch = 0
    const y0 = game.player.pos.y
    game.input.jump = true
    await new Promise(r => setTimeout(r, 350))
    game.input.jump = false
    return game.player.pos.y - y0
  })()`)
  check('跳跃', jumped > 0.5, `最高升 ${jumped.toFixed(2)} 格`)

  // 夜晚渲染
  await page.evaluate('game.setDayTime(0.75)')
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(root, 'shots/night.png') })
  check('昼夜切换截图', true)

  const fps = await page.evaluate('game.fps')
  console.log(`ℹ️  无头软渲染 FPS: ${fps}(真机 GPU 会高很多)`)
  check('最终无 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
  vite.kill()
}
console.log(failed === 0 ? '\n🎉 冒烟测试全部通过' : `\n💥 ${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
