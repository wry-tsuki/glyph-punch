import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadStore, saveStore } from './storage'
import { createWork } from './types'

class MemoryStorage {
  private data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storage', () => {
  it('round-trips works and the current id', () => {
    const work = createWork({ title: '测试作品', text: '床前明月光' })
    saveStore({ works: [work], currentId: work.id })

    const loaded = loadStore()
    expect(loaded?.currentId).toBe(work.id)
    expect(loaded?.works[0].title).toBe('测试作品')
    expect(loaded?.works[0].text).toBe('床前明月光')
  })

  it('fills missing font and jitter from legacy saves', () => {
    const work = createWork()
    const legacy = {
      works: [
        {
          ...work,
          fontId: undefined,
          tiles: [{ charId: 3, x: 120, y: 300, z: 1, rot: 1.5, scale: 1 }],
        },
      ],
      currentId: work.id,
    }
    localStorage.setItem('glyph-punch.v1', JSON.stringify(legacy))

    const loaded = loadStore()
    expect(loaded?.works[0].fontId).toBe('wenkai')
    expect(loaded?.works[0].tiles[0].jitter).toMatchObject({
      dx: expect.any(Number),
      dy: expect.any(Number),
      rot: expect.any(Number),
      scale: expect.any(Number),
      radius: expect.any(Number),
    })
  })

  it('falls back to the first work when currentId is unknown', () => {
    const work = createWork()
    saveStore({ works: [work], currentId: 'missing' })

    expect(loadStore()?.currentId).toBe(work.id)
  })

  it('returns null for corrupt or empty storage', () => {
    localStorage.setItem('glyph-punch.v1', '{ not json')
    expect(loadStore()).toBeNull()

    localStorage.clear()
    expect(loadStore()).toBeNull()
  })
})
