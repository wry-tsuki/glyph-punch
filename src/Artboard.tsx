import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { BoardLayout } from './layout'
import { holeGeometry, legacyJitter } from './holes'
import type { CharCell, Palette, PunchJitter, Tile, Work } from './types'

interface TextLayerProps {
  cells: CharCell[]
  punchedKey: string
  jitters: Map<number, PunchJitter>
  workId: string
  ink: string
  accent: string
  fontStack: string
}

const TextLayer = memo(function TextLayer({
  cells,
  punchedKey,
  jitters,
  workId,
  ink,
  accent,
  fontStack,
}: TextLayerProps) {
  const punched = punchedKey ? new Set(punchedKey.split(',').map(Number)) : new Set<number>()
  const holes: React.ReactNode[] = []
  const glyphs: React.ReactNode[] = []

  for (const cell of cells) {
    if (punched.has(cell.id)) {
      const jitter = jitters.get(cell.id) ?? legacyJitter(cell.id, workId)
      const hole = holeGeometry(jitter, cell)
      holes.push(
        <div
          key={`h${cell.id}`}
          className="hole"
          data-char={cell.id}
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
  incoming: IncomingFlight | null
  resetting: boolean
  onPunch: (charId: number) => void
  onPunchAt: (charId: number, x: number, y: number) => void
  onMoveTile: (charId: number, x: number, y: number) => void
  onReturnTile: (charId: number) => void
}

export interface IncomingFlight {
  charId: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  rot: number
  width: number
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
  incoming,
  resetting,
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

  const { layout, chars, artW, artH, compTop } = board
  const size = layout.size

  useEffect(
    () => () => {
      if (flightTimer.current !== null) window.clearTimeout(flightTimer.current)
    },
    [],
  )

  // 只有字片的抖动变化时才重建映射，拖动位置不会让原文层重渲染。
  const jitterKey = work.tiles
    .map(
      (tile) =>
        `${tile.charId}:${tile.jitter.rot}:${tile.jitter.scale}:${tile.jitter.dx}:${tile.jitter.dy}:${tile.jitter.radius}`,
    )
    .join('|')
  const jitters = useMemo(
    () => new Map(work.tiles.map((tile) => [tile.charId, tile.jitter] as const)),
    [jitterKey],
  )

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

  /* ---------- 创作区纸片拖拽 / 点击回填 ---------- */

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
    const jitter = tile.jitter
    const hole = holeGeometry(jitter, cell)
    flightRef.current = charId
    setFlight({
      charId,
      fromX: tile.x,
      fromY: tile.y,
      toX: hole.left,
      toY: hole.top,
      rot: jitter.rot,
      width: size * jitter.scale,
      started: false,
    })
    requestAnimationFrame(() => {
      setFlight((current) =>
        current && current.charId === charId ? { ...current, started: true } : current,
      )
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
    const tileSize = size * (dragged?.jitter.scale ?? 1)
    const nextX = Math.max(0, Math.min(artW - tileSize, dragging.tileX + dx))
    const nextY = Math.max(compTop, Math.min(artH - tileSize, dragging.tileY + dy))
    onMoveTile(dragging.charId, nextX, nextY)
  }

  return (
    <div
      className={`board${resetting ? ' is-resetting' : ''}`}
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
        jitters={jitters}
        workId={work.id}
        ink={palette.ink}
        accent={palette.accent}
        fontStack={fontStack}
      />
      {work.tiles.map((tile) => {
        if (resetting) return null
        if (flight?.charId === tile.charId) return null
        if (incoming?.charId === tile.charId) return null
        const isDragging = tileDrag?.charId === tile.charId
        const left = isDragging ? tile.x + tileDrag.dx : tile.x
        const top = isDragging ? tile.y + tileDrag.dy : tile.y
        const jitter = tile.jitter
        const tileSize = size * jitter.scale
        return (
          <div
            key={tile.charId}
            className={`tile${isDragging ? ' is-dragging' : ''}`}
            data-char={tile.charId}
            style={{
              left,
              top,
              width: tileSize,
              height: tileSize,
              borderRadius: jitter.radius * size,
              transform: `rotate(${jitter.rot}deg)`,
              zIndex: isDragging ? 999 : tile.z,
              background: palette.chip,
              color: palette.chipInk,
              fontSize: tileSize,
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
      {resetting
        ? work.tiles.map((tile, index) => {
            const cell = layout.cells.find((item) => item.id === tile.charId)
            if (!cell) return null
            const hole = holeGeometry(tile.jitter, cell)
            const tileSize = size * tile.jitter.scale
            return (
              <div
                key={`reset-${tile.charId}`}
                className="tile-return"
                style={
                  {
                    left: tile.x,
                    top: tile.y,
                    width: tileSize,
                    height: tileSize,
                    fontSize: tileSize,
                    background: palette.chip,
                    color: palette.chipInk,
                    fontFamily: fontStack,
                    '--dx': `${hole.left - tile.x}px`,
                    '--dy': `${hole.top - tile.y}px`,
                    '--delay': `${Math.min(index, 12) * 18}ms`,
                  } as React.CSSProperties
                }
              >
                {chars[tile.charId]}
              </div>
            )
          })
        : null}
      {incoming ? (
        <div
          key={incoming.charId}
          className="tile-punch"
          style={
            {
              left: incoming.fromX,
              top: incoming.fromY,
              width: incoming.width,
              height: incoming.width,
              fontSize: incoming.width,
              background: palette.chip,
              color: palette.chipInk,
              fontFamily: fontStack,
              '--dx': `${incoming.toX - incoming.fromX}px`,
              '--dy': `${incoming.toY - incoming.fromY}px`,
              '--rot': `${incoming.rot}deg`,
            } as React.CSSProperties
          }
        >
          {chars[incoming.charId]}
        </div>
      ) : null}
      {flight ? (
        <div
          className="tile-fly"
          style={{
            left: flight.fromX,
            top: flight.fromY,
            width: flight.width,
            height: flight.width,
            fontSize: flight.width,
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
            fontSize: size,
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
