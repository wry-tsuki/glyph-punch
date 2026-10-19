import { memo, useEffect, useRef, useState } from 'react'
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
  onPunchAt: (charId: number, x: number, y: number) => void
  onMoveTile: (charId: number, x: number, y: number) => void
  onReturnTile: (charId: number) => void
}

interface TileDrag {
  charId: number
  dx: number
  dy: number
  moved: boolean
  overText: boolean
}

interface TextDrag {
  charId: number
  x: number
  y: number
  active: boolean
  overComp: boolean
}

interface ReturnFlight {
  charId: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  rot: number
  width: number
  started: boolean
}

export default function Artboard({
  work,
  board,
  palette,
  fontStack,
  seed,
  onPunch,
  onPunchAt,
  onMoveTile,
  onReturnTile,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const tileDragRef = useRef<{
    charId: number
    startX: number
    startY: number
    tileX: number
    tileY: number
    moved: boolean
  } | null>(null)
  const textDragRef = useRef<{
    charId: number
    startX: number
    startY: number
    active: boolean
  } | null>(null)
  const [tileDrag, setTileDrag] = useState<TileDrag | null>(null)
  const [textDrag, setTextDrag] = useState<TextDrag | null>(null)
  const [flight, setFlight] = useState<ReturnFlight | null>(null)
  const flightRef = useRef<number | null>(null)
  const flightTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (flightTimer.current !== null) window.clearTimeout(flightTimer.current)
    },
    [],
  )

  const { layout, chars, artW, artH, compTop } = board
  const size = layout.size

  const toBoard = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const k = rect.width / artW
    return { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k }
  }

  /* ---------- 从原文拖字 ---------- */

  const startTextDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = (event.target as HTMLElement).closest<HTMLElement>('.glyph')
    if (!target) return
    const charId = Number(target.dataset.id)
    if (!Number.isFinite(charId)) return
    const point = toBoard(event.clientX, event.clientY)
    textDragRef.current = { charId, startX: point.x, startY: point.y, active: false }
    setTextDrag({ charId, x: point.x, y: point.y, active: false, overComp: point.y >= compTop })
    boardRef.current?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const moveTextDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = textDragRef.current
    if (!dragging) return
    const point = toBoard(event.clientX, event.clientY)
    const active =
      dragging.active || Math.hypot(point.x - dragging.startX, point.y - dragging.startY) > 4
    dragging.active = active
    setTextDrag({
      charId: dragging.charId,
      x: point.x,
      y: point.y,
      active,
      overComp: point.y >= compTop,
    })
  }

  const endTextDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = textDragRef.current
    if (!dragging) return
    const point = toBoard(event.clientX, event.clientY)
    textDragRef.current = null
    setTextDrag(null)
    if (!dragging.active) {
      onPunch(dragging.charId)
      return
    }
    if (point.y >= compTop) onPunchAt(dragging.charId, point.x, point.y)
  }

  /* ---------- 创作区纸片拖拽 / 点击 ---------- */

  const startTileDrag = (event: React.PointerEvent<HTMLDivElement>, tile: Tile) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const point = toBoard(event.clientX, event.clientY)
    tileDragRef.current = {
      charId: tile.charId,
      startX: point.x,
      startY: point.y,
      tileX: tile.x,
      tileY: tile.y,
      moved: false,
    }
    setTileDrag({ charId: tile.charId, dx: 0, dy: 0, moved: false, overText: false })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveTileDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = tileDragRef.current
    if (!dragging) return
    const point = toBoard(event.clientX, event.clientY)
    const dx = point.x - dragging.startX
    const dy = point.y - dragging.startY
    const moved = dragging.moved || Math.hypot(dx, dy) > 4
    dragging.moved = moved
    setTileDrag({ charId: dragging.charId, dx, dy, moved, overText: point.y < compTop })
  }

  const startReturn = (charId: number) => {
    if (flightRef.current !== null) return
    const tile = work.tiles.find((item) => item.charId === charId)
    const cell = layout.cells.find((item) => item.id === charId)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!tile || !cell || reduceMotion) {
      onReturnTile(charId)
      return
    }
    const hole = holeGeometry(charId, seed, cell)
    flightRef.current = charId
    setFlight({
      charId,
      fromX: tile.x,
      fromY: tile.y,
      toX: hole.left,
      toY: hole.top,
      rot: hole.rot,
      width: size * tile.scale,
      started: false,
    })
    requestAnimationFrame(() => {
      setFlight((current) => (current && current.charId === charId ? { ...current, started: true } : current))
    })
    flightTimer.current = window.setTimeout(() => {
      flightRef.current = null
      flightTimer.current = null
      setFlight(null)
      onReturnTile(charId)
    }, 280)
  }

  const endTileDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = tileDragRef.current
    if (!dragging) return
    const point = toBoard(event.clientX, event.clientY)
    const dx = point.x - dragging.startX
    const dy = point.y - dragging.startY
    tileDragRef.current = null
    setTileDrag(null)

    if (!dragging.moved) {
      startReturn(dragging.charId)
      return
    }
    if (point.y < compTop) {
      onReturnTile(dragging.charId)
      return
    }
    const dragged = work.tiles.find((tile) => tile.charId === dragging.charId)
    const tileSize = size * (dragged?.scale ?? 1)
    const nextX = Math.max(0, Math.min(artW - tileSize, dragging.tileX + dx))
    const nextY = Math.max(compTop, Math.min(artH - tileSize, dragging.tileY + dy))
    onMoveTile(dragging.charId, nextX, nextY)
  }

  return (
    <div
      className="board"
      ref={boardRef}
      onPointerDown={startTextDrag}
      onPointerMove={moveTextDrag}
      onPointerUp={endTextDrag}
      onPointerCancel={endTextDrag}
      style={
        {
          width: artW,
          height: artH,
          background: palette.paper,
          '--accent': palette.accent,
        } as React.CSSProperties
      }
    >
      <div
        className={`comp-zone${textDrag?.active && textDrag.overComp ? ' is-drop' : ''}`}
        style={{ top: compTop, background: palette.accent }}
        aria-hidden
      >
        {work.tiles.length === 0 ? (
          <span className="comp-hint" style={{ color: palette.chip }}>
            从原文拖字到这里
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
        if (flight?.charId === tile.charId) return null
        const isDragging = tileDrag?.charId === tile.charId
        const left = isDragging ? tile.x + tileDrag.dx : tile.x
        const top = isDragging ? tile.y + tileDrag.dy : tile.y
        const tileSize = size * tile.scale
        return (
          <div
            key={tile.charId}
            className={`tile${isDragging ? ' is-dragging' : ''}`}
            style={{
              left,
              top,
              width: tileSize,
              height: tileSize,
              transform: `rotate(${tile.rot}deg)`,
              zIndex: isDragging ? 999 : tile.z,
              background: palette.chip,
              color: palette.chipInk,
              fontSize: tileSize * 0.82,
              fontWeight: 600,
              fontFamily: fontStack,
            }}
            onPointerDown={(event) => startTileDrag(event, tile)}
            onPointerMove={moveTileDrag}
            onPointerUp={endTileDrag}
            onPointerCancel={endTileDrag}
          >
            {chars[tile.charId]}
          </div>
        )
      })}
      <div className={`dropzone${tileDrag?.overText ? ' is-active' : ''}`} style={{ height: compTop }}>
        {tileDrag?.overText ? <span className="drop-hint">松手放回原文</span> : null}
      </div>
      {flight ? (
        <div
          className="tile-fly"
          style={{
            left: flight.fromX,
            top: flight.fromY,
            width: flight.width,
            height: flight.width,
            fontSize: flight.width * 0.82,
            background: palette.chip,
            color: palette.chipInk,
            fontFamily: fontStack,
            transform: `translate(${flight.started ? flight.toX - flight.fromX : 0}px, ${
              flight.started ? flight.toY - flight.fromY : 0
            }px) rotate(${flight.rot}deg)`,
            opacity: flight.started ? 0.08 : 1,
            transition: 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 260ms ease-in',
          }}
        >
          {chars[flight.charId]}
        </div>
      ) : null}
      {textDrag?.active ? (
        <div
          className="text-ghost"
          style={{
            left: textDrag.x - size / 2,
            top: textDrag.y - size / 2,
            width: size,
            height: size,
            background: palette.chip,
            color: palette.chipInk,
            fontSize: size * 0.82,
            fontFamily: fontStack,
          }}
        >
          {chars[textDrag.charId]}
        </div>
      ) : null}
      {layout.cells.length === 0 ? (
        <div className="board-empty">
          <p>粘贴一段古诗文，开始打孔</p>
        </div>
      ) : null}
    </div>
  )
}
