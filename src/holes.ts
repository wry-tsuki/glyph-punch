import type { CharCell } from './types'

export interface HoleGeometry {
  left: number
  top: number
  width: number
  height: number
  rot: number
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

/**
 * 手工打孔的抖动：位置、尺寸、旋转、圆角都带一点偏差。
 * 相邻的孔保留各自的偏差，所以整排孔看起来是手抠的，而不是机器切出来的。
 */
export function holeGeometry(charId: number, seed: number, cell: CharCell): HoleGeometry {
  const rand = mulberry32((Math.imul(charId + 1, 2654435761) ^ seed) >>> 0)
  const size = cell.size
  const width = size * (0.97 + rand() * 0.06)
  const height = size * (0.97 + rand() * 0.06)
  const dx = (rand() - 0.5) * size * 0.07
  const dy = (rand() - 0.5) * size * 0.07
  const rot = (rand() - 0.5) * 6
  const radius = size * (0.006 + rand() * 0.02)

  return {
    left: cell.x + (size - width) / 2 + dx,
    top: cell.y + (size - height) / 2 + dy,
    width,
    height,
    rot,
    radius,
  }
}
