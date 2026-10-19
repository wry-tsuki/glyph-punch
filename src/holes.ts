import type { CharCell, PunchJitter } from './types'

export interface HoleGeometry {
  left: number
  top: number
  width: number
  height: number
  rot: number
  radius: number
}

/** 稳定的字符串种子，用于旧作品迁移时的确定性回退。 */
export function hashSeed(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** 每次取字都生成一个新种子：同一首字重复取放，角度和偏移都会变。 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

export function jitterFromSeed(seed: number): PunchJitter {
  const rand = mulberry32(seed)
  return {
    dx: (rand() - 0.5) * 0.07,
    dy: (rand() - 0.5) * 0.07,
    rot: (rand() - 0.5) * 6,
    scale: 0.97 + rand() * 0.06,
    radius: 0.006 + rand() * 0.02,
  }
}

export function randomJitter(): PunchJitter {
  return jitterFromSeed(randomSeed())
}

/** 旧作品没有存 jitter 时，用作品 ID + 字序号生成一个稳定的兜底。 */
export function legacyJitter(charId: number, workId: string): PunchJitter {
  return jitterFromSeed(hashSeed(`${workId}:${charId}`))
}

/**
 * 手工打孔：位置、尺寸、旋转、圆角都带一点偏差。
 * 纸片取同一个 jitter，所以洞就是那块料被拿走后的样子。
 */
export function holeGeometry(jitter: PunchJitter, cell: CharCell): HoleGeometry {
  const width = cell.size * jitter.scale
  const height = width
  return {
    left: cell.x + (cell.size - width) / 2 + jitter.dx * cell.size,
    top: cell.y + (cell.size - height) / 2 + jitter.dy * cell.size,
    width,
    height,
    rot: jitter.rot,
    radius: jitter.radius * cell.size,
  }
}
