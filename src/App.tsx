import { useEffect, useMemo, useRef, useState } from 'react'
import Artboard from './Artboard'
import { exportPng } from './exportPng'
import { FONT_PACKS, fontPackOf } from './fonts'
import { hashSeed } from './holes'
import { alignTiles, computeLayout, flowSlot } from './layout'
import { initialStore, loadStore, saveStore, type Persisted } from './storage'
import {
  ALIGN_MODES,
  PALETTES,
  RATIOS,
  createWork,
  paletteOf,
  type AlignMode,
  type RatioId,
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
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.42)

  const board = useMemo(
    () => computeLayout(current),
    [current.text, current.ratio, current.align],
  )
  const palette = paletteOf(current.paletteId)
  const fontPack = fontPackOf(current.fontId)
  const seed = useMemo(() => hashSeed(current.id), [current.id])

  useEffect(() => {
    saveStore({ works: state.works, currentId: state.currentId })
  }, [state.works, state.currentId])

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

  const undo = () => {
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

  const addTile = (charId: number, x: number, y: number, rot: number) => {
    const topZ = current.tiles.reduce((max, tile) => Math.max(max, tile.z), 0)
    commit({
      ...current,
      punched: [...current.punched, charId],
      tiles: [...current.tiles, { charId, x, y, rot, z: topZ + 1 }],
    })
  }

  const randomRot = () => (Math.random() - 0.5) * 12

  const punch = (charId: number) => {
    if (current.punched.includes(charId)) return
    if (board.chars[charId] === '\n') return
    const size = board.layout.size
    const slot = flowSlot(current.tiles.length, size, board.artW, board.artH, board.compTop)
    const x = Math.max(
      0,
      Math.min(board.artW - size, slot.x + (Math.random() - 0.5) * size * 0.6),
    )
    const y = Math.max(
      board.compTop,
      Math.min(board.artH - size, slot.y + (Math.random() - 0.5) * size * 0.5),
    )
    addTile(charId, x, y, randomRot())
  }

  const punchAt = (charId: number, centerX: number, centerY: number) => {
    if (current.punched.includes(charId)) return
    if (board.chars[charId] === '\n') return
    const size = board.layout.size
    const x = Math.max(0, Math.min(board.artW - size, centerX - size / 2))
    const y = Math.max(board.compTop, Math.min(board.artH - size, centerY - size / 2))
    addTile(charId, x, y, randomRot())
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

  const doAlign = () => {
    if (current.tiles.length === 0) return
    commit({
      ...current,
      tiles: alignTiles(current, board.layout.size, board.artW, board.artH, board.compTop),
    })
  }

  const changeRatio = (ratio: RatioId) => {
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
    setState((previous) => ({ ...previous, currentId: id, past: [], future: [] }))
  }

  const addWork = () => {
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
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>glyph punch</h1>
            <p>古诗文打孔器</p>
          </div>
        </div>

        <section className="section">
          <div className="section-title">作品</div>
          <div className="row">
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
            <button className="btn" type="button" onClick={addWork}>
              新建
            </button>
            <button className="btn" type="button" onClick={removeWork}>
              删除
            </button>
          </div>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={applyTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            aria-label="作品标题"
            placeholder="作品标题"
          />
        </section>

        <section className="section">
          <div className="section-title">文本</div>
          <textarea
            className="textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            aria-label="古诗文文本"
            placeholder="粘贴一首古诗文，换行会保留"
          />
          <div className="row">
            <button className="btn btn-primary" type="button" onClick={applyText}>
              应用文本
            </button>
            <span className="hint">{board.layout.cells.length} 字</span>
          </div>
        </section>

        <section className="section">
          <div className="section-title">版式</div>
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
          <div className="seg" role="group" aria-label="文本对齐">
            {ALIGN_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={current.align === mode.id ? 'is-active' : ''}
                aria-pressed={current.align === mode.id}
                onClick={() => commit({ ...current, align: mode.id as AlignMode })}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-title">配色</div>
          <div className="swatches">
            {PALETTES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`swatch${current.paletteId === item.id ? ' is-active' : ''}`}
                aria-pressed={current.paletteId === item.id}
                onClick={() => commit({ ...current, paletteId: item.id })}
              >
                <span className="swatch-pair" aria-hidden="true">
                  <i style={{ background: item.paper }} />
                  <i style={{ background: item.accent }} />
                </span>
                <span className="swatch-name">{item.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-title">字体</div>
          <div className="seg" role="group" aria-label="字体包">
            {FONT_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className={current.fontId === pack.id ? 'is-active' : ''}
                aria-pressed={current.fontId === pack.id}
                onClick={() => commit({ ...current, fontId: pack.id })}
              >
                {pack.name}
              </button>
            ))}
          </div>
          <p className="stat">{fontPack.note}</p>
        </section>

        <section className="section">
          <div className="section-title">操作</div>
          <div className="row">
            <button className="btn" type="button" onClick={doAlign} disabled={current.tiles.length === 0}>
              对齐
            </button>
            <button className="btn" type="button" onClick={undo} disabled={state.past.length === 0}>
              撤销
            </button>
            <button className="btn" type="button" onClick={redo} disabled={state.future.length === 0}>
              重做
            </button>
          </div>
          <button className="btn btn-primary btn-block" type="button" onClick={doExport} disabled={busy}>
            {busy ? '导出中…' : '导出 PNG'}
          </button>
          <p className="stat">
            {current.punched.length} 个孔 · 字号 {board.layout.size}px · {RATIOS[current.ratio].label}
          </p>
        </section>

        <p className="rail-footer">v{__APP_VERSION__} · 预览版 · 作品存在本机</p>
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
              seed={seed}
              onPunch={punch}
              onPunchAt={punchAt}
              onMoveTile={moveTile}
              onReturnTile={returnTile}
            />
          </div>
        </div>
        <p className="stage-hint">
          从原文拖字到创作区 · 点击创作区的字放回原文 · 对齐会重新随机
        </p>
      </main>
    </div>
  )
}
