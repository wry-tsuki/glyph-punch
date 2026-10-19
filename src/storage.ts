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
    if (!parsed.works.some((w) => w.id === parsed.currentId)) {
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
