import { memo, useRef, useState } from 'react'
import type { BoardLayout } from './layout'
import { holeGeometry } from './holes'
import type { CharCell, Palette, Tile, Work } from './types'

interface TextLayerProps {
  cells: CharCell[]
  punchedKey: string
  ink: string
  accent: string
  fontStack: string
  seed: number
}

const TextLayer = memo(function TextLayer({
  cells,
  punchedKey,
  ink,
  accent,
  fontStack,
  seed,
}: TextLayerProps) {
  const punched = punchedKey ? new Set(punchedKey.split(',').map(Number)) : new Set<number>()
  const holes: React.ReactNode[] = []
  const glyphs: React.ReactNode[] = []

  for (const cell of cells) {
    if (punched.has(cell.id)) {
      const hole = holeGeometry(cell.id, seed, cell)
      holes.push(
        <div
          key={`h${cell.id}`}
          className="hole"
          style={{
            left: hole.left,
            top: hole.top,
            width: hole.width,
            height: hole.height,
            borderRadius: hole.radius,
            background: accent,
            transform: `rotate(${hole.rot}deg)`,
          }}
        />,
      )
      continue
    }
    glyphs.push(
      <span
        key={`g${cell.id}`}
        className="glyph"
        data-id={cell.id}
        style={{
          left: cell.x,
          top: cell.y,
          width: cell.size,
          height: cell.size,
          fontSize: cell.size,
          lineHeight: `${cell.size}px`,
          color: ink,
          fontFamily: fontStack,
        }}
      >
        {cell.ch}
      </span>,
    )
  }

  return (
    <>
      {holes}
      {glyphs}
    </>
  )
})

interface Props {
  work: Work
  board: BoardLayout
  palette: Palette
  fontStack: string
  seed: number
  onPunch: (charId: number) => void
  onMoveTile: (charId: number, x: number, y: number) => void
  onReturnTile: (charId: number) => void
  onRaiseTile: (charId: number) => void
}

interface DragState {
  charId: number
  dx: number
  dy: number
  moved: boolean
  overText: boolean
}

export default function Artboard({
  work,
  board,
  palette,
  fontStack,
  seed,
  onPunch,
  onMoveTile,
  onReturnTile,
  onRaiseTile,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    charId: number
    startX: number
    startY: number
    tileX: number
    tileY: number
    moved: boolean
  } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const { layout, chars, artW, artH, compTop } = board
  const size = layout.size

  const toBoard = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const k = rect.width / artW
    return { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k }
  }

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, tile: Tile) => {
    if (event.button !== 0) return
    event.preventDefault()
    const point = toBoard(event.clientX, event.clientY)
    dragRef.current = {
      charId: tile.charId,
      startX: point.x,
      startY: point.y,
      tileX: tile.x,
      tileY: tile.y,
      moved: false,
    }
    setDrag({ charId: tile.charId, dx: 0, dy: 0, moved: false, overText: false })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = dragRef.current
    if (!dragging) return
    const point = toBoard(event.clientX, event.clientY)
    const dx = point.x - dragging.startX
    const dy = point.y - dragging.startY
    const moved = dragging.moved || Math.hypot(dx, dy) > 4
    dragging.moved = moved
    setDrag({ charId: dragging.charId, dx, dy, moved, overText: point.y < compTop })
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = dragRef.current
    if (!dragging) return
    const point = toBoard(event.clientX, event.clientY)
    const dx = point.x - dragging.startX
    const dy = point.y - dragging.startY
    dragRef.current = null
    setDrag(null)

    if (dragging.moved && point.y < compTop) {
      onReturnTile(dragging.charId)
      return
    }
    if (dragging.moved) {
      const nextX = Math.max(0, Math.min(artW - size, dragging.tileX + dx))
      const nextY = Math.max(compTop, Math.min(artH - size, dragging.tileY + dy))
      onMoveTile(dragging.charId, nextX, nextY)
      return
    }
    onRaiseTile(dragging.charId)
  }

  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('.glyph')
    if (!target) return
    const id = Number(target.dataset.id)
    if (Number.isFinite(id)) onPunch(id)
  }

  return (
    <div
      className="board"
      ref={boardRef}
      onClick={handleBoardClick}
      style={
        {
          width: artW,
          height: artH,
          background: palette.paper,
          '--accent': palette.accent,
        } as React.CSSProperties
      }
    >
      <div className="comp-zone" style={{ top: compTop, background: palette.accent }} aria-hidden>
        {work.tiles.length === 0 ? (
          <span className="comp-hint" style={{ color: palette.chip }}>
            打孔后，字会落到这里
          </span>
        ) : null}
      </div>
      <TextLayer
        cells={layout.cells}
        punchedKey={work.punched.join(',')}
        ink={palette.ink}
        accent={palette.accent}
        fontStack={fontStack}
        seed={seed}
      />
      {work.tiles.map((tile) => {
        const isDragging = drag?.charId === tile.charId
        const left = isDragging ? tile.x + drag.dx : tile.x
        const top = isDragging ? tile.y + drag.dy : tile.y
        return (
          <div
            key={tile.charId}
            className={`tile${isDragging ? ' is-dragging' : ''}`}
            style={{
              left,
              top,
              width: size,
              height: size,
              transform: `rotate(${tile.rot}deg)`,
              zIndex: isDragging ? 999 : tile.z,
              background: palette.chip,
              color: palette.chipInk,
              fontSize: size * 0.82,
              fontWeight: 600,
              fontFamily: fontStack,
            }}
            onPointerDown={(event) => startDrag(event, tile)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {chars[tile.charId]}
          </div>
        )
      })}
      <div className={`dropzone${drag?.overText ? ' is-active' : ''}`} style={{ height: compTop }}>
        {drag?.overText ? <span className="drop-hint">松手放回原文</span> : null}
      </div>
      {layout.cells.length === 0 ? (
        <div className="board-empty">
          <p>粘贴一段古诗文，开始打孔</p>
        </div>
      ) : null}
    </div>
  )
}
