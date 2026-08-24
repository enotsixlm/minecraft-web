# 星露农场（网页版）

Canvas 2D 的星露谷物语风格农场小游戏：耕地、浇水、播种、收获、开店买卖、睡觉过天。零外部图片资源，像素风程序绘制。

## 运行

```bash
npm install
npm run dev      # http://localhost:5173
npm run smoke    # 无头冒烟测试 + 截图到 shots/
npm run build    # 产物到 dist/
```

## 操作

| 按键 | 作用 |
|------|------|
| WASD / 方向键 | 移动 |
| 空格 / 鼠标左键 | 使用当前工具或种子 |
| 1–8 | 切换快捷栏 |
| E | 在杂货店门口打开皮埃尔商店 |
| Enter | 在床边睡觉，进入下一天 |
| Esc | 菜单 / 关闭商店 |

## 玩法

- 用**锄头**把泥土翻成耕地，**喷壶**浇水，再播下种子
- 作物只有浇过水才会在过夜后生长；成熟后用**镰刀**收获
- 走到右上角杂货店买种子，或一键卖出背包里的作物换金币
- 体力会随劳作下降，睡觉后恢复；时间会流逝，凌晨两点会强制睡觉
- 进度自动写入 `localStorage`

## 结构

- `src/crops.js` — 作物与商店商品
- `src/world.js` — 地图、地块、作物生长
- `src/player.js` — 玩家、背包、工具逻辑
- `src/render.js` — 像素风渲染与粒子
- `src/audio.js` — WebAudio 合成音效
- `src/main.js` — 主循环、HUD、存档
- `tools/smoke.mjs` — Playwright 冒烟测试
