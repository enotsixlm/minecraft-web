/** 作物、采集物与物品定义 */

export const CROPS = {
  parsnip: {
    id: 'parsnip',
    name: '防风草',
    seedName: '防风草种子',
    color: '#e8b84a',
    leaf: '#5aa64a',
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
    color: '#c4a06a',
    leaf: '#4f8f3e',
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
    color: '#f2f0e4',
    leaf: '#3d7a3a',
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
    color: '#e23d3d',
    leaf: '#3d7a3a',
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
    color: '#e87ab5',
    leaf: '#4f8f3e',
    seedPrice: 30,
    sellPrice: 70,
    daysToGrow: 5,
    stages: 4,
    description: '美丽的春花，装饰与赚钱两相宜。',
  },
}

export const FORAGE = {
  daffodil: { id: 'daffodil', name: '黄水仙', color: '#f4d35e', sellPrice: 30 },
  leek: { id: 'leek', name: '野韭', color: '#8fd17a', sellPrice: 40 },
  horseradish: { id: 'horseradish', name: '山葵', color: '#d6e8c8', sellPrice: 35 },
  spring_onion: { id: 'spring_onion', name: '春季洋葱', color: '#6aa84f', sellPrice: 25 },
}

export const TOOLS = {
  hoe: { id: 'hoe', name: '锄头', icon: 'hoe', kind: 'tool' },
  can: { id: 'can', name: '喷壶', icon: 'can', kind: 'tool' },
  scythe: { id: 'scythe', name: '镰刀', icon: 'scythe', kind: 'tool' },
}

export function seedItem(cropId) {
  const c = CROPS[cropId]
  return {
    id: `seed_${cropId}`,
    cropId,
    name: c.seedName,
    icon: 'seed',
    color: c.color,
    kind: 'seed',
  }
}

export function harvestItem(cropId, qty = 1) {
  const c = CROPS[cropId]
  return {
    id: `crop_${cropId}`,
    cropId,
    name: c.name,
    icon: 'crop',
    color: c.color,
    kind: 'crop',
    qty,
    sellPrice: c.sellPrice,
  }
}

export function forageItem(forageId, qty = 1) {
  const f = FORAGE[forageId]
  return {
    id: `forage_${forageId}`,
    forageId,
    name: f.name,
    icon: 'forage',
    color: f.color,
    kind: 'crop',
    qty,
    sellPrice: f.sellPrice,
  }
}

export const SHOP_SEEDS = Object.keys(CROPS)
