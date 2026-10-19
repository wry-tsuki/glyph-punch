import type { BoardLayout } from './layout'
import type { Palette, Work } from './types'
import { FONT_STACK } from './layout'

export async function exportPng(
  work: Work,
  board: BoardLayout,
  palette: Palette,
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

  ctx.fillStyle = palette.paper
  ctx.fillRect(0, 0, artW, artH)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${size}px ${FONT_STACK}`

  for (const cell of layout.cells) {
    if (punched.has(cell.id)) {
      ctx.fillStyle = palette.accent
      ctx.fillRect(cell.x, cell.y, cell.size, cell.size)
    } else {
      ctx.fillStyle = palette.ink
      ctx.fillText(cell.ch, cell.x + cell.size / 2, cell.y + cell.size * 0.54)
    }
  }

  ctx.fillStyle = palette.accent
  ctx.fillRect(0, compTop, artW, artH - compTop)

  for (const tile of work.tiles) {
    const cx = tile.x + size / 2
    const cy = tile.y + size / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((tile.rot * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = size * 0.18
    ctx.shadowOffsetY = size * 0.06
    ctx.fillStyle = palette.chip
    ctx.fillRect(-size / 2, -size / 2, size, size)
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = palette.chipInk
    ctx.font = `600 ${size * 0.82}px ${FONT_STACK}`
    ctx.fillText(chars[tile.charId] ?? '', 0, size * 0.02)
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
