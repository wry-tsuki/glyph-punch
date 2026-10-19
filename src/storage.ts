import { DEFAULT_FONT_ID } from './fonts'
import { hashSeed, punchJitter } from './holes'
import { createWork, type Work } from './types'

const KEY = 'glyph-punch.v1'

export interface Persisted {
  works: Work[]
  currentId: string
}

export function loadStore(): Persisted | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Persisted
    if (!Array.isArray(parsed.works) || parsed.works.length === 0) return null
    parsed.works = parsed.works.map((work) => {
      const seed = hashSeed(work.id)
      return {
        ...work,
        fontId: work.fontId ?? DEFAULT_FONT_ID,
        tiles: (work.tiles ?? []).map((tile) => {
          const jitter = punchJitter(tile.charId, seed)
          return {
            ...tile,
            // 旋转角统一回打孔抖动，保证洞和纸片是同一块料。
            rot: jitter.rot,
            scale: tile.scale ?? jitter.scale,
          }
        }),
      }
    })
    if (!parsed.works.some((work) => work.id === parsed.currentId)) {
      parsed.currentId = parsed.works[0].id
    }
    return parsed
  } catch {
    return null
  }
}

export function saveStore(store: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* storage full or unavailable: autosave is best-effort */
  }
}

export function initialStore(): Persisted {
  const work = createWork()
  return { works: [work], currentId: work.id }
}
