import type { CharCell } from './types'

export interface HoleGeometry {
  left: number
  top: number
  width: number
  height: number
  rot: number
  radius: number
}

/** 一块被抠下来的料：洞和纸片共用这一组参数。dx/dy/radius 以字宽为单位。 */
export interface PunchJitter {
  dx: number
  dy: number
  rot: number
  scale: number
  radius: number
}

/** 稳定的字符串种子，让同一份作品的孔洞抖动始终一致。 */
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

export function punchJitter(charId: number, seed: number): PunchJitter {
  const rand = mulberry32((Math.imul(charId + 1, 2654435761) ^ seed) >>> 0)
  return {
    dx: (rand() - 0.5) * 0.07,
    dy: (rand() - 0.5) * 0.07,
    rot: (rand() - 0.5) * 6,
    scale: 0.97 + rand() * 0.06,
    radius: 0.006 + rand() * 0.02,
  }
}

/**
 * 手工打孔：位置、尺寸、旋转、圆角都带一点偏差。
 * 纸片取同样的 jitter，所以洞就是那块料被拿走后的样子。
 */
export function holeGeometry(charId: number, seed: number, cell: CharCell): HoleGeometry {
  const jitter = punchJitter(charId, seed)
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
