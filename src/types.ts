import { DEFAULT_FONT_ID } from './fonts'

export type RatioId = '3:4' | '1:1' | '9:16'

export const RATIOS: Record<RatioId, { w: number; h: number; label: string }> = {
  '3:4': { w: 1080, h: 1440, label: '3 : 4' },
  '1:1': { w: 1080, h: 1080, label: '1 : 1' },
  '9:16': { w: 1080, h: 1920, label: '9 : 16' },
}

export interface Palette {
  id: string
  name: string
  paper: string
  ink: string
  accent: string
  chip: string
  chipInk: string
}

export const PALETTES: Palette[] = [
  {
    id: 'xuan',
    name: '宣纸 · 石青',
    paper: '#F0E2B4',
    ink: '#1E2A38',
    accent: '#3E5D7C',
    chip: '#F6ECD2',
    chipInk: '#22303F',
  },
  {
    id: 'moon',
    name: '月白 · 墨',
    paper: '#E6ECEF',
    ink: '#1B232B',
    accent: '#2C3E50',
    chip: '#F4F7F8',
    chipInk: '#1B232B',
  },
  {
    id: 'zhu',
    name: '米 · 朱',
    paper: '#F3E9D6',
    ink: '#2A211C',
    accent: '#A6402E',
    chip: '#FAF3E6',
    chipInk: '#3A2A22',
  },
  {
    id: 'indigo',
    name: '靛 · 米',
    paper: '#1C2B3A',
    ink: '#EADFC4',
    accent: '#0F1720',
    chip: '#EADFC4',
    chipInk: '#1C2B3A',
  },
]

export interface CharCell {
  id: number
  ch: string
  x: number
  y: number
  size: number
}

/** 一块被抠下来的料：洞和纸片共用这一组参数。 */
export interface PunchJitter {
  dx: number
  dy: number
  rot: number
  scale: number
  radius: number
}

export interface Tile {
  charId: number
  x: number
  y: number
  z: number
  jitter: PunchJitter
}

export interface Work {
  id: string
  title: string
  text: string
  ratio: RatioId
  paletteId: string
  fontId: string
  punched: number[]
  tiles: Tile[]
  updatedAt: number
}

export const SAMPLE_TEXT = `精华欲掩料应难，影自娟娟魄自寒。
一片砧敲千里白，半轮鸡唱五更残。
绿蓑江上秋闻笛，红袖楼头夜倚栏。
博得嫦娥应借问，缘何不使永团圆。`

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function createWork(partial: Partial<Work> = {}): Work {
  return {
    id: uid(),
    title: '未命名作品',
    text: SAMPLE_TEXT,
    ratio: '3:4',
    paletteId: 'xuan',
    fontId: DEFAULT_FONT_ID,
    punched: [],
    tiles: [],
    updatedAt: Date.now(),
    ...partial,
  }
}

export function paletteOf(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}
