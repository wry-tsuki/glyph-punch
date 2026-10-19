import { useEffect, useMemo, useRef, useState } from 'react'
import Artboard, { type IncomingFlight } from './Artboard'
import { exportPng } from './exportPng'
import { FONT_PACKS, fontPackOf } from './fonts'
import { holeGeometry, randomJitter } from './holes'
import { alignTiles, computeLayout, randomTileSlot } from './layout'
import { initialStore, loadStore, saveStore, type Persisted } from './storage'
import {
  PALETTES,
  RATIOS,
  TILE_ALIGNS,
  createWork,
  paletteOf,
  type PunchJitter,
  type RatioId,
  type TileAlign,
  type Work,
} from './types'

interface AppState extends Persisted {
  past: Work[]
  future: Work[]
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const base = loadStore() ?? initialStore()
    return { ...base, past: [], future: [] }
  })

  const current = state.works.find((work) => work.id === state.currentId) ?? state.works[0]
  const [draft, setDraft] = useState(current.text)
  const [title, setTitle] = useState(current.title)
  const [busy, setBusy] = useState(false)
  const [incoming, setIncoming] = useState<IncomingFlight | null>(null)
  const [resetting, setResetting] = useState(false)
  const [tileAlign, setTileAlign] = useState<TileAlign>('center')
  const incomingTimer = useRef<number | null>(null)
  const resetTimer = useRef<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.42)

  const board = useMemo(
    () => computeLayout(current),
    [current.text, current.ratio],
  )
  const palette = paletteOf(current.paletteId)
  const fontPack = fontPackOf(current.fontId)

  useEffect(() => {
    saveStore({ works: state.works, currentId: state.currentId })
  }, [state.works, state.currentId])

  useEffect(
    () => () => {
      if (incomingTimer.current !== null) window.clearTimeout(incomingTimer.current)
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    },
    [],
  )

  useEffect(() => {
    setDraft(current.text)
    setTitle(current.title)
  }, [current.id, current.text, current.title])

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect()
      const next = Math.min((rect.width - 96) / board.artW, (rect.height - 120) / board.artH, 1)
      setScale(Math.max(0.18, next))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [board.artW, board.artH])

  const commit = (next: Work) => {
    setState((previous) => {
      const before = previous.works.find((work) => work.id === previous.currentId)
      return {
        ...previous,
        works: previous.works.map((work) =>
          work.id === previous.currentId ? { ...next, updatedAt: Date.now() } : work,
        ),
        past: before ? [...previous.past.slice(-49), before] : previous.past,
        future: [],
      }
    })
  }

  const cancelIncoming = () => {
    if (incomingTimer.current !== null) {
      window.clearTimeout(incomingTimer.current)
      incomingTimer.current = null
    }
    setIncoming(null)
  }

  const resetAll = () => {
    if (resetting) return
    if (current.tiles.length === 0 && current.punched.length === 0) return
    cancelIncoming()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || current.tiles.length === 0) {
      commit({ ...current, punched: [], tiles: [] })
      return
    }
    const duration = 320 + Math.min(current.tiles.length, 12) * 18 + 90
    setResetting(true)
    resetTimer.current = window.setTimeout(() => {
      resetTimer.current = null
      setResetting(false)
      commit({ ...current, punched: [], tiles: [] })
    }, duration)
  }

  const undo = () => {
    if (resetting) return
    setState((previous) => {
      const restored = previous.past[previous.past.length - 1]
      if (!restored) return previous
      const currentWork = previous.works.find((work) => work.id === previous.currentId)
      return {
        ...previous,
        past: previous.past.slice(0, -1),
        future: currentWork ? [currentWork, ...previous.future] : previous.future,
        works: previous.works.map((work) =>
          work.id === previous.currentId ? restored : work,
        ),
      }
    })
  }

  const redo = () => {
    if (resetting) return
    setState((previous) => {
      const restored = previous.future[0]
      if (!restored) return previous
      const currentWork = previous.works.find((work) => work.id === previous.currentId)
      return {
        ...previous,
        past: currentWork ? [...previous.past, currentWork] : previous.past,
        future: previous.future.slice(1),
        works: previous.works.map((work) =>
          work.id === previous.currentId ? restored : work,
        ),
      }
    })
  }

  const addTile = (charId: number, x: number, y: number, jitter: PunchJitter) => {
    const topZ = current.tiles.reduce((max, tile) => Math.max(max, tile.z), 0)
    commit({
      ...current,
      punched: [...current.punched, charId],
      tiles: [...current.tiles, { charId, x, y, z: topZ + 1, jitter }],
    })
  }

  const punch = (charId: number) => {
    if (resetting) return
    if (current.punched.includes(charId)) return
    if (board.chars[charId] === '\n') return
    const size = board.layout.size
    const jitter = randomJitter()
    const tileSize = size * jitter.scale
    const slot = randomTileSlot(
      current.tiles,
      tileSize,
      size,
      board.artW,
      board.artH,
      board.compTop,
    )
    addTile(charId, slot.x, slot.y, jitter)

    const cell = board.layout.cells.find((item) => item.id === charId)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!cell || reduceMotion) return

    const hole = holeGeometry(jitter, cell)
    if (incomingTimer.current !== null) window.clearTimeout(incomingTimer.current)
    setIncoming({
      charId,
      fromX: hole.left,
      fromY: hole.top,
      toX: slot.x,
      toY: slot.y,
      rot: jitter.rot,
      width: tileSize,
    })
    incomingTimer.current = window.setTimeout(() => {
      incomingTimer.current = null
      setIncoming(null)
    }, 360)
  }

  const punchAt = (charId: number, centerX: number, centerY: number) => {
    if (resetting) return
    if (current.punched.includes(charId)) return
    if (board.chars[charId] === '\n') return
    const size = board.layout.size
    const jitter = randomJitter()
    const tileSize = size * jitter.scale
    const x = Math.max(0, Math.min(board.artW - tileSize, centerX - tileSize / 2))
    const y = Math.max(board.compTop, Math.min(board.artH - tileSize, centerY - tileSize / 2))
    addTile(charId, x, y, jitter)
  }

  const moveTile = (charId: number, x: number, y: number) => {
    const topZ = current.tiles.reduce((max, tile) => Math.max(max, tile.z), 0)
    commit({
      ...current,
      tiles: current.tiles.map((tile) =>
        tile.charId === charId ? { ...tile, x, y, z: topZ + 1 } : tile,
      ),
    })
  }

  const returnTile = (charId: number) => {
    commit({
      ...current,
      punched: current.punched.filter((id) => id !== charId),
      tiles: current.tiles.filter((tile) => tile.charId !== charId),
    })
  }

  const alignTo = (mode: TileAlign) => {
    if (resetting) return
    setTileAlign(mode)
    if (current.tiles.length === 0) return
    commit({
      ...current,
      tiles: alignTiles(current, board.layout.size, board.artW, board.artH, board.compTop, mode),
    })
  }

  const changeRatio = (ratio: RatioId) => {
    if (resetting) return
    if (ratio === current.ratio) return
    const from = RATIOS[current.ratio]
    const to = RATIOS[ratio]
    const nextBoard = computeLayout({ ...current, ratio })
    const size = nextBoard.layout.size
    const tiles = current.tiles.map((tile) => ({
      ...tile,
      x: Math.max(0, Math.min(nextBoard.artW - size, (tile.x / from.w) * to.w)),
      y: Math.max(nextBoard.compTop, Math.min(nextBoard.artH - size, (tile.y / from.h) * to.h)),
    }))
    commit({ ...current, ratio, tiles })
  }

  const applyText = () => {
    if (resetting) return
    cancelIncoming()
    commit({ ...current, text: draft, punched: [], tiles: [] })
  }

  const applyTitle = () => {
    const clean = title.trim()
    if (!clean) {
      setTitle(current.title)
      return
    }
    if (clean !== current.title) commit({ ...current, title: clean })
  }

  const switchWork = (id: string) => {
    if (resetting) return
    cancelIncoming()
    setState((previous) => ({ ...previous, currentId: id, past: [], future: [] }))
  }

  const addWork = () => {
    cancelIncoming()
    const work = createWork({ title: `作品 ${state.works.length + 1}`, text: '' })
    setState((previous) => ({
      ...previous,
      works: [...previous.works, work],
      currentId: work.id,
      past: [],
      future: [],
    }))
  }

  const removeWork = () => {
    cancelIncoming()
    setState((previous) => {
      if (previous.works.length <= 1) {
        const fresh = createWork({ text: '' })
        return { works: [fresh], currentId: fresh.id, past: [], future: [] }
      }
      const remaining = previous.works.filter((work) => work.id !== previous.currentId)
      return {
        works: remaining,
        currentId: remaining[0].id,
        past: [],
        future: [],
      }
    })
  }

  const doExport = async () => {
    setBusy(true)
    try {
      await exportPng(current, board, palette, fontPack.stack)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div className="brand-text">
              <h1>glyph punch</h1>
              <p>古诗文打孔器</p>
            </div>
          </div>

          <div className="doc">
            <input
              className="doc-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={applyTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              aria-label="作品标题"
              placeholder="未命名作品"
              title="重命名作品"
            />
            <div className="doc-row">
              {state.works.length > 1 ? (
                <select
                  className="select"
                  value={current.id}
                  onChange={(event) => switchWork(event.target.value)}
                  aria-label="选择作品"
                >
                  {state.works.map((work) => (
                    <option key={work.id} value={work.id}>
                      {work.title}
                    </option>
                  ))}
                </select>
              ) : null}
              <button className="mini" type="button" onClick={addWork} title="新建作品">
                新建
              </button>
              <button className="mini" type="button" onClick={removeWork} title="删除当前作品">
                删除
              </button>
            </div>
          </div>
        </div>

        <div className="rail-scroll">
          <section className="group">
            <h2 className="group-head">
              <span>纸面</span>
            </h2>

            <div className="field">
              <div className="field-head">
                <label htmlFor="work-text">正文</label>
                <span>{board.layout.cells.length} 字</span>
              </div>
              <textarea
                id="work-text"
                className="textarea"
                style={{ fontFamily: fontPack.stack }}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                spellCheck={false}
                aria-label="古诗文文本"
                placeholder="粘贴一首古诗文，换行会保留"
              />
              <div className="field-foot">
                <span>换行会保留</span>
                <button className="mini is-primary" type="button" onClick={applyText}>
                  应用文本
                </button>
              </div>
            </div>

            <div className="field">
              <div className="field-head">
                <span>比例</span>
                <span>{RATIOS[current.ratio].label}</span>
              </div>
              <div className="seg" role="group" aria-label="画板比例">
                {(Object.keys(RATIOS) as RatioId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={current.ratio === id ? 'is-active' : ''}
                    aria-pressed={current.ratio === id}
                    onClick={() => changeRatio(id)}
                  >
                    {RATIOS[id].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <div className="field-head">
                <span>配色</span>
                <span>{palette.name}</span>
              </div>
              <div className="palette-row">
                {PALETTES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`palette-chip${current.paletteId === item.id ? ' is-active' : ''}`}
                    aria-label={item.name}
                    aria-pressed={current.paletteId === item.id}
                    title={item.name}
                    onClick={() => commit({ ...current, paletteId: item.id })}
                  >
                    <i style={{ background: item.paper }} />
                    <i style={{ background: item.accent }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <div className="field-head">
                <span>字体</span>
                <span>{fontPack.note}</span>
              </div>
              <div className="font-row" role="group" aria-label="字体包">
                {FONT_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    className={`font-chip${current.fontId === pack.id ? ' is-active' : ''}`}
                    aria-pressed={current.fontId === pack.id}
                    style={{ fontFamily: pack.stack }}
                    onClick={() => commit({ ...current, fontId: pack.id })}
                  >
                    {pack.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="group">
            <h2 className="group-head">
              <span>创作</span>
            </h2>

            <div className="field">
              <div className="field-head">
                <span>排布</span>
                <span>{current.punched.length} 个孔</span>
              </div>
              <div className="seg" role="group" aria-label="纸片对齐">
                {TILE_ALIGNS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={tileAlign === item.id ? 'is-active' : ''}
                    aria-pressed={tileAlign === item.id}
                    disabled={current.tiles.length === 0 || resetting}
                    onClick={() => alignTo(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="dock">
          <div className="dock-actions">
            <button
              className="mini"
              type="button"
              onClick={undo}
              disabled={state.past.length === 0 || resetting}
            >
              撤销
            </button>
            <button
              className="mini"
              type="button"
              onClick={redo}
              disabled={state.future.length === 0 || resetting}
            >
              重做
            </button>
            <button
              className="reset-link"
              type="button"
              onClick={resetAll}
              disabled={current.tiles.length === 0 || resetting}
              title="所有纸片飞回原文，可撤销"
            >
              {resetting ? '放回中…' : '全部放回原文'}
            </button>
          </div>
          <button className="export" type="button" onClick={doExport} disabled={busy || resetting}>
            {busy ? '导出中…' : '导出 PNG'}
          </button>
          <p className="rail-foot">v{__APP_VERSION__} · 预览版 · 作品存在本机</p>
        </div>
      </aside>

      <main className="stage" ref={stageRef}>
        <div className="frame" style={{ width: board.artW * scale, height: board.artH * scale }}>
          <div
            className="board-scaler"
            style={{
              width: board.artW,
              height: board.artH,
              transform: `scale(${scale})`,
            }}
          >
            <Artboard
              work={current}
              board={board}
              palette={palette}
              fontStack={fontPack.stack}
              incoming={incoming}
              resetting={resetting}
              onPunch={punch}
              onPunchAt={punchAt}
              onMoveTile={moveTile}
              onReturnTile={returnTile}
            />
          </div>
        </div>
        <p className="stage-hint">
          从原文拖字到创作区 · 点击创作区的字放回原文 · 排布按钮点一下即时对齐
        </p>
      </main>
    </div>
  )
}
