/** 作物与物品定义 */

export const CROPS = {
  parsnip: {
    id: 'parsnip',
    name: '防风草',
    seedName: '防风草种子',
    emoji: '🌱',
    harvestEmoji: '🥕',
    seedPrice: 20,
    sellPrice: 50,
    daysToGrow: 4,
    stages: 4,
    description: '春天的可靠作物，四天成熟。',
  },
  potato: {
    id: 'potato',
    name: '土豆',
    seedName: '土豆种子',
    emoji: '🌿',
    harvestEmoji: '🥔',
    seedPrice: 50,
    sellPrice: 120,
    daysToGrow: 6,
    stages: 5,
    description: '耐种好卖，六天收获。',
  },
  cauliflower: {
    id: 'cauliflower',
    name: '花椰菜',
    seedName: '花椰菜种子',
    emoji: '🥬',
    harvestEmoji: '🥦',
    seedPrice: 80,
    sellPrice: 220,
    daysToGrow: 10,
    stages: 5,
    description: '生长较慢，卖价可观。',
  },
  strawberry: {
    id: 'strawberry',
    name: '草莓',
    seedName: '草莓种子',
    emoji: '🪴',
    harvestEmoji: '🍓',
    seedPrice: 100,
    sellPrice: 90,
    daysToGrow: 8,
    stages: 5,
    regrow: 4,
    description: '首次八天成熟，之后每隔四天再收。',
  },
  tulip: {
    id: 'tulip',
    name: '郁金香',
    seedName: '郁金香种子',
    emoji: '🌷',
    harvestEmoji: '🌷',
    seedPrice: 30,
    sellPrice: 70,
    daysToGrow: 5,
    stages: 4,
    description: '美丽的春花，装饰与赚钱两相宜。',
  },
}

export const TOOLS = {
  hoe: { id: 'hoe', name: '锄头', emoji: '🪓', kind: 'tool' },
  can: { id: 'can', name: '喷壶', emoji: '💧', kind: 'tool' },
  scythe: { id: 'scythe', name: '镰刀', emoji: '⚔️', kind: 'tool' },
}

export function seedItem(cropId) {
  const c = CROPS[cropId]
  return {
    id: `seed_${cropId}`,
    cropId,
    name: c.seedName,
    emoji: '🌱',
    kind: 'seed',
  }
}

export function harvestItem(cropId, qty = 1) {
  const c = CROPS[cropId]
  return {
    id: `crop_${cropId}`,
    cropId,
    name: c.name,
    emoji: c.harvestEmoji,
    kind: 'crop',
    qty,
    sellPrice: c.sellPrice,
  }
}

export const SHOP_SEEDS = Object.keys(CROPS)
