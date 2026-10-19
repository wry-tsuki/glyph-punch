export interface FontPack {
  id: string
  name: string
  note: string
  stack: string
}

export const FONT_PACKS: FontPack[] = [
  {
    id: 'wenkai',
    name: '霞鹜文楷',
    note: '手写楷体，起笔带锋',
    stack: '"LXGW WenKai", "Noto Serif SC Variable", "Songti SC", "SimSun", serif',
  },
  {
    id: 'noto',
    name: '思源宋体',
    note: '现代宋体，横细竖粗',
    stack: '"Noto Serif SC Variable", "Songti SC", "SimSun", serif',
  },
]

export const DEFAULT_FONT_ID = 'wenkai'

export function fontPackOf(id?: string): FontPack {
  return FONT_PACKS.find((pack) => pack.id === id) ?? FONT_PACKS[0]
}
