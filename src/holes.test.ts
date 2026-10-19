import { describe, expect, it } from 'vitest'
import { hashSeed, holeGeometry, jitterFromSeed, legacyJitter, randomSeed } from './holes'
import type { CharCell } from './types'

const cell: CharCell = { id: 7, ch: '字', x: 100, y: 200, size: 58 }

describe('jitter', () => {
  it('is deterministic for a given seed', () => {
    expect(jitterFromSeed(42)).toEqual(jitterFromSeed(42))
    expect(jitterFromSeed(42)).not.toEqual(jitterFromSeed(43))
  })

  it('stays inside the documented ranges', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const jitter = jitterFromSeed(seed)
      expect(Math.abs(jitter.dx)).toBeLessThanOrEqual(0.035)
      expect(Math.abs(jitter.dy)).toBeLessThanOrEqual(0.035)
      expect(Math.abs(jitter.rot)).toBeLessThanOrEqual(3)
      expect(jitter.scale).toBeGreaterThanOrEqual(0.97)
      expect(jitter.scale).toBeLessThanOrEqual(1.03)
      expect(jitter.radius).toBeGreaterThanOrEqual(0.006)
      expect(jitter.radius).toBeLessThanOrEqual(0.026)
    }
  })

  it('produces distinct seeds for successive draws', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => randomSeed()))
    expect(seeds.size).toBeGreaterThan(15)
  })

  it('keeps legacy jitter stable for the same work and character', () => {
    expect(legacyJitter(3, 'work-a')).toEqual(legacyJitter(3, 'work-a'))
    expect(legacyJitter(3, 'work-a')).not.toEqual(legacyJitter(3, 'work-b'))
  })

  it('hashes strings stably', () => {
    expect(hashSeed('glyph-punch')).toBe(hashSeed('glyph-punch'))
    expect(hashSeed('glyph-punch')).not.toBe(hashSeed('glyph-punch '))
  })
})

describe('holeGeometry', () => {
  it('is the same piece of material as the chip', () => {
    const jitter = jitterFromSeed(123)
    const hole = holeGeometry(jitter, cell)
    const centerX = cell.x + cell.size / 2 + jitter.dx * cell.size
    const centerY = cell.y + cell.size / 2 + jitter.dy * cell.size

    expect(hole.width).toBeCloseTo(cell.size * jitter.scale)
    expect(hole.height).toBeCloseTo(hole.width)
    expect(hole.left + hole.width / 2).toBeCloseTo(centerX)
    expect(hole.top + hole.height / 2).toBeCloseTo(centerY)
    expect(hole.rot).toBe(jitter.rot)
    expect(hole.radius).toBeCloseTo(jitter.radius * cell.size)
  })
})
