import { afterEach, describe, expect, it, vi } from 'vitest'
import { alignTiles, computeLayout, flowSlot, PAD, randomTileSlot } from './layout'
import { createWork, type Tile, type Work } from './types'

const SIZE = 58
const ART_W = 1080
const ART_H = 1440
const COMP_TOP = 1037

function tile(charId: number, x: number, y: number, scale = 1): Tile {
  return {
    charId,
    x,
    y,
    z: 1,
    jitter: { dx: 0, dy: 0, rot: 0, scale, radius: 0.01 },
  }
}

function makeWork(tiles: Tile[]): Work {
  return createWork({ text: '一二三四五', tiles })
}

function rowsOf(tiles: Tile[]): Tile[][] {
  const rows: Tile[][] = []
  for (const item of [...tiles].sort((a, b) => a.y - b.y)) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(row[0].y - item.y) <= 20) row.push(item)
    else rows.push([item])
  }
  return rows
}

function edges(row: Tile[]): { left: number; right: number; center: number } {
  const left = Math.min(...row.map((item) => item.x))
  const right = Math.max(...row.map((item) => item.x + SIZE * item.jitter.scale))
  return { left, right, center: (left + right) / 2 }
}

function expectNear(actual: number, expected: number, tolerance = 1): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('computeLayout', () => {
  it('keeps hard line breaks and uses the 3:4 artboard by default', () => {
    const work = createWork({
      text: '精华欲掩料应难，影自娟娟魄自寒。\n一片砧敲千里白，半轮鸡唱五更残。',
    })
    const board = computeLayout(work)

    expect(board.artW).toBe(1080)
    expect(board.artH).toBe(1440)
    expect(board.compTop).toBe(Math.round(1440 * 0.72))
    expect(board.layout.overflow).toBe(false)
    expect(board.layout.lineCount).toBe(2)
    expect(board.layout.cells).toHaveLength(32)

    const ys = new Set(board.layout.cells.map((cell) => cell.y))
    expect(ys.size).toBe(2)
  })

  it('switches artboard dimensions with the ratio', () => {
    const square = computeLayout(createWork({ ratio: '1:1' }))
    const story = computeLayout(createWork({ ratio: '9:16' }))

    expect(square.artH).toBe(1080)
    expect(story.artH).toBe(1920)
    expect(square.artW).toBe(1080)
    expect(story.artW).toBe(1080)
  })

  it('wraps long prose inside the text area instead of overflowing', () => {
    const text = '字'.repeat(300)
    const board = computeLayout(createWork({ text }))
    const availRight = board.artW - PAD

    expect(board.layout.cells).toHaveLength(300)
    expect(board.layout.lineCount).toBeGreaterThan(1)
    expect(board.layout.overflow).toBe(false)
    for (const cell of board.layout.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(PAD)
      expect(cell.x + cell.size).toBeLessThanOrEqual(availRight + 0.001)
    }
  })

  it('handles empty text without producing cells', () => {
    const board = computeLayout(createWork({ text: '' }))
    expect(board.layout.cells).toHaveLength(0)
  })
})

describe('alignTiles', () => {
  const work = makeWork([
    tile(0, 100, 1100),
    tile(1, 200, 1100),
    tile(2, 300, 1100),
    tile(3, 200, 1250),
    tile(4, 300, 1250),
  ])

  it('centers the whole block regardless of alignment mode', () => {
    for (const mode of ['left', 'center', 'justify'] as const) {
      const result = alignTiles(work, SIZE, ART_W, ART_H, COMP_TOP, mode)
      const blockLeft = Math.min(...result.map((item) => item.x))
      const blockRight = Math.max(...result.map((item) => item.x + SIZE * item.jitter.scale))
      expectNear((blockLeft + blockRight) / 2, ART_W / 2)
    }
  })

  it('left alignment starts every row at the block left edge', () => {
    const rows = rowsOf(alignTiles(work, SIZE, ART_W, ART_H, COMP_TOP, 'left'))
    const longest = edges(rows[0]).right - edges(rows[0]).left
    const blockLeft = PAD + (ART_W - PAD * 2 - longest) / 2

    for (const row of rows) {
      expectNear(edges(row).left, blockLeft)
    }
  })

  it('justify stretches short rows to the longest row edges', () => {
    const rows = rowsOf(alignTiles(work, SIZE, ART_W, ART_H, COMP_TOP, 'justify'))
    const first = edges(rows[0])
    const second = edges(rows[1])

    expectNear(second.left, first.left, 1.5)
    expectNear(second.right, first.right, 1.5)
  })

  it('centers a single-tile row when justifying', () => {
    const single = makeWork([tile(0, 100, 1100), tile(1, 300, 1250), tile(2, 400, 1250)])
    const rows = rowsOf(alignTiles(single, SIZE, ART_W, ART_H, COMP_TOP, 'justify'))

    expect(rows[0]).toHaveLength(1)
    expectNear(edges(rows[0]).center, ART_W / 2)
  })
})

describe('randomTileSlot', () => {
  it('returns a position inside the composition area', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const slot = randomTileSlot([], SIZE, SIZE, ART_W, ART_H, COMP_TOP)

    expect(slot.x).toBeGreaterThanOrEqual(PAD)
    expect(slot.y).toBeGreaterThan(COMP_TOP)
    expect(slot.x + SIZE).toBeLessThanOrEqual(ART_W - PAD)
    expect(slot.y + SIZE).toBeLessThanOrEqual(ART_H)
  })

  it('falls back to the flow slot when every attempt collides', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const blocker = makeWork([tile(0, 511, 1209.5)]).tiles

    const slot = randomTileSlot(blocker, SIZE, SIZE, ART_W, ART_H, COMP_TOP)
    expect(slot).toEqual(flowSlot(1, SIZE, ART_W, ART_H, COMP_TOP))
  })
})
