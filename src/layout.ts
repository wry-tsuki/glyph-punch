import type { AlignMode, CharCell, RatioId, Work } from './types'
import { RATIOS } from './types'

export const PAD = 76
export const LINE_HEIGHT = 1.62
export const TEXT_AREA_RATIO = 0.66
export const COMP_TOP_RATIO = 0.72

export interface TextLayout {
  size: number
  cells: CharCell[]
  lineCount: number
  overflow: boolean
  bottom: number
}

export function charsOf(text: string): string[] {
  return Array.from(text)
}

function buildLines(chars: string[], perLine: number): number[][] {
  const lines: number[][] = []
  let cur: number[] = []
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === '\n') {
      // 只有真正有字、或用户敲了连续空行时才结束一行，
      // 避免“正好填满一行 + 换行”多算出一个空行。
      if (cur.length > 0 || i === 0 || chars[i - 1] === '\n') lines.push(cur)
      cur = []
      continue
    }
    cur.push(i)
    if (cur.length >= perLine) {
      lines.push(cur)
      cur = []
    }
  }
  if (cur.length || lines.length === 0) lines.push(cur)
  return lines
}

function layoutAt(
  chars: string[],
  size: number,
  availW: number,
  availH: number,
  align: AlignMode,
  originX: number,
  originY: number,
): TextLayout {
  const perLine = Math.max(1, Math.floor(availW / size))
  const lines = buildLines(chars, perLine)
  const lh = size * LINE_HEIGHT
  const height = lines.length * lh
  const cells: CharCell[] = []

  lines.forEach((ids, row) => {
    const n = ids.length
    if (n === 0) return
    let x0 = 0
    let step = size
    if (align === 'right') x0 = availW - n * size
    else if (align === 'center') x0 = (availW - n * size) / 2
    else if (align === 'justify' && n > 1) step = (availW - size) / (n - 1)

    ids.forEach((id, k) => {
      cells.push({
        id,
        ch: chars[id],
        x: originX + x0 + k * step,
        y: originY + row * lh,
        size,
      })
    })
  })

  return { size, cells, lineCount: lines.length, overflow: height > availH, bottom: originY + height }
}

export interface BoardLayout {
  layout: TextLayout
  chars: string[]
  artW: number
  artH: number
  compTop: number
}

export function computeLayout(work: Work): BoardLayout {
  const ratio: RatioId = work.ratio
  const { w: artW, h: artH } = RATIOS[ratio]
  const chars = charsOf(work.text)
  const originX = PAD
  const availW = artW - PAD * 2
  const availH = artH * TEXT_AREA_RATIO - PAD

  // 先尝试让每一行都不折行：字号由最长的一行决定。
  const paragraphs = work.text.split('\n')
  const longest = Math.max(1, ...paragraphs.map((line) => Array.from(line).length))
  const noWrapSize = Math.min(96, Math.floor(availW / longest))

  let best = 0
  if (noWrapSize >= 14) {
    const trial = layoutAt(chars, noWrapSize, availW, availH, work.align, originX, 0)
    if (trial.lineCount * noWrapSize * LINE_HEIGHT <= availH) best = noWrapSize
  }

  // 长文或单行过长时退回“折行 + 二分找最大字号”。
  if (best === 0) {
    let lo = 6
    let hi = Math.min(96, Math.floor(availW))
    best = 6
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const test = layoutAt(chars, mid, availW, availH, work.align, originX, 0)
      if (!test.overflow) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
  }

  const measured = layoutAt(chars, best, availW, availH, work.align, originX, 0)
  const textHeight = measured.lineCount * best * LINE_HEIGHT
  const originY = PAD + Math.max(0, (availH - textHeight) / 2)
  const layout = layoutAt(chars, best, availW, availH, work.align, originX, originY)
  return { layout, chars, artW, artH, compTop: Math.round(artH * COMP_TOP_RATIO) }
}

export function flowSlot(
  index: number,
  size: number,
  artW: number,
  artH: number,
  compTop: number,
): { x: number; y: number } {
  const step = size * 1.34
  const usable = artW - PAD * 2
  const cols = Math.max(1, Math.floor(usable / step))
  const col = index % cols
  const row = Math.floor(index / cols)
  const x = PAD + col * step
  const y = Math.min(compTop + 44 + row * size * 1.5, artH - size - 8)
  return { x, y }
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

export function alignTiles(
  work: Work,
  size: number,
  artW: number,
  artH: number,
  compTop: number,
): Work['tiles'] {
  if (work.tiles.length === 0) return []

  const tolerance = size * 0.9
  const sorted = [...work.tiles].sort((a, b) => a.y - b.y)
  const rows: Work['tiles'][] = []

  for (const tile of sorted) {
    const centerY = tile.y + size / 2
    const row = rows[rows.length - 1]
    if (row && Math.abs(row[0].y + size / 2 - centerY) <= tolerance) {
      row.push(tile)
    } else {
      rows.push([tile])
    }
  }

  const maxW = artW - PAD * 2
  const naturalGap = size * 0.24
  const out: Work['tiles'] = []
  const rowStep = size * 1.6
  const zoneH = artH - compTop
  const startY =
    compTop + Math.max(28, (zoneH - rows.length * rowStep) / 2) + (rowStep - size) / 2

  rows.forEach((row, rowIndex) => {
    const cells = [...row].sort((a, b) => a.x - b.x)
    const available = maxW - cells.length * size
    const gap = Math.max(0, Math.min(naturalGap, cells.length > 1 ? available / (cells.length - 1) : 0))
    const lineW = cells.length * size + (cells.length - 1) * gap
    const startX = PAD + (maxW - lineW) / 2
    const rowY = Math.min(startY + rowIndex * rowStep, artH - size - 8)

    cells.forEach((tile, i) => {
      out.push({
        ...tile,
        x: startX + i * (size + gap) + rand(-size * 0.04, size * 0.04),
        y: rowY + rand(-size * 0.05, size * 0.05),
        rot: rand(-2.6, 2.6),
      })
    })
  })

  return out
}
