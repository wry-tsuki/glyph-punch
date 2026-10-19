import type { BoardLayout } from './layout'
import { hashSeed, holeGeometry } from './holes'
import type { Palette, Work } from './types'

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

export async function exportPng(
  work: Work,
  board: BoardLayout,
  palette: Palette,
  fontStack: string,
): Promise<void> {
  const { layout, chars, artW, artH, compTop } = board
  if (document.fonts?.ready) await document.fonts.ready

  const canvas = document.createElement('canvas')
  canvas.width = artW
  canvas.height = artH
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const size = layout.size
  const punched = new Set(work.punched)
  const seed = hashSeed(work.id)

  ctx.fillStyle = palette.paper
  ctx.fillRect(0, 0, artW, artH)

  // 孔洞：与 DOM 使用同一套抖动参数，逐字绘制。
  ctx.fillStyle = palette.accent
  for (const cell of layout.cells) {
    if (!punched.has(cell.id)) continue
    const hole = holeGeometry(cell.id, seed, cell)
    ctx.save()
    ctx.translate(hole.left + hole.width / 2, hole.top + hole.height / 2)
    ctx.rotate((hole.rot * Math.PI) / 180)
    roundedRect(ctx, -hole.width / 2, -hole.height / 2, hole.width, hole.height, hole.radius)
    ctx.fill()
    ctx.restore()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${size}px ${fontStack}`

  for (const cell of layout.cells) {
    if (punched.has(cell.id)) continue
    ctx.fillStyle = palette.ink
    ctx.fillText(cell.ch, cell.x + cell.size / 2, cell.y + cell.size * 0.54)
  }

  ctx.fillStyle = palette.accent
  ctx.fillRect(0, compTop, artW, artH - compTop)

  for (const tile of work.tiles) {
    const tileSize = size * tile.scale
    const cx = tile.x + tileSize / 2
    const cy = tile.y + tileSize / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((tile.rot * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = tileSize * 0.18
    ctx.shadowOffsetY = tileSize * 0.06
    ctx.fillStyle = palette.chip
    ctx.fillRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize)
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = palette.chipInk
    ctx.font = `600 ${tileSize * 0.82}px ${fontStack}`
    ctx.fillText(chars[tile.charId] ?? '', 0, tileSize * 0.02)
    ctx.restore()
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(work.title || 'glyph-punch').replace(/[\\/:*?"<>|]/g, '-')}-${work.ratio.replace(':', 'x')}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
