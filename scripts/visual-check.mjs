import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: '.shots/01-initial.png' })

const board = await page.locator('.board').boundingBox()
const ids = await page
  .locator('.glyph')
  .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')))

// 1. 点击原文三个字：自动落到创作区
for (const id of ids.slice(0, 3)) {
  await page.locator(`.glyph[data-id="${id}"]`).click()
  await page.waitForTimeout(80)
}
await page.waitForTimeout(450)
const tilesAfterClick = await page.locator('.tile').count()

const tileBoxes = await page.locator('.tile').evaluateAll((nodes) =>
  nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
  }),
)
const overlapping = tileBoxes.some((box, index) =>
  tileBoxes.slice(index + 1).some(
    (other) =>
      box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y,
  ),
)

const readGeometry = () =>
  page.evaluate(() => {
    const shape = (node) => ({
      id: node.dataset.char,
      rot: node.style.transform,
      w: node.style.width,
    })
    const holes = [...document.querySelectorAll('.hole')].map(shape)
    const tiles = [...document.querySelectorAll('.tile')].map(shape)
    const byId = (list) =>
      list
        .slice()
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((item) => `${item.id}|${item.rot}|${item.w}`)
        .join(';')
    return { holes, tiles, matched: byId(holes) === byId(tiles) }
  })

const geometryAfterClick = await readGeometry()
const sameShape = geometryAfterClick.matched

// 2. 从原文拖第四个字到创作区，松手位置即落点
const dragId = ids[3]
const glyphBox = await page.locator(`.glyph[data-id="${dragId}"]`).boundingBox()
const drop = { x: board.x + board.width * 0.55, y: board.y + board.height * 0.8 }
await page.mouse.move(glyphBox.x + glyphBox.width / 2, glyphBox.y + glyphBox.height / 2)
await page.mouse.down()
await page.mouse.move(drop.x, drop.y, { steps: 14 })
await page.waitForTimeout(150)
await page.screenshot({ path: '.shots/02-text-drag.png' })
await page.mouse.up()
await page.waitForTimeout(350)
await page.screenshot({ path: '.shots/03-dropped.png' })

const tilesAfterDrop = await page.locator('.tile').count()
const lastTile = await page.locator('.tile').last().boundingBox()
const dropDelta = lastTile
  ? Math.hypot(lastTile.x + lastTile.width / 2 - drop.x, lastTile.y + lastTile.height / 2 - drop.y)
  : -1

// 3. 点击创作区的字，弹回原文
await page.locator('.tile').first().click()
await page.waitForTimeout(120)
await page.screenshot({ path: '.shots/05-flight.png' })
await page.waitForTimeout(400)
const tilesAfterReturnClick = await page.locator('.tile').count()

// 4. 拖纸片回原文区，同样回填
const tileBox = await page.locator('.tile').first().boundingBox()
await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2)
await page.mouse.down()
await page.mouse.move(board.x + board.width / 2, board.y + board.height * 0.2, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(300)
const tilesAfterDragBack = await page.locator('.tile').count()

// 5. 纸片字号应与原文字号一致
const fontSizeProbe = await page.evaluate(() => {
  const glyph = document.querySelector('.glyph')
  const tile = document.querySelector('.tile')
  return {
    glyph: glyph ? getComputedStyle(glyph).fontSize : null,
    tile: tile ? getComputedStyle(tile).fontSize : null,
  }
})

// 6. 同一个字重新取一次，应当得到新的随机角度/尺寸
const randomCharId = ids[20]
const readLastTile = async () =>
  page
    .locator('.tile')
    .last()
    .evaluate((node) => ({ transform: node.style.transform, width: node.style.width }))

await page.locator(`.glyph[data-id="${randomCharId}"]`).click()
await page.waitForTimeout(350)
const firstShape = await readLastTile()
await page.locator('.tile').last().click()
await page.waitForTimeout(650)
await page.locator(`.glyph[data-id="${randomCharId}"]`).click()
await page.waitForTimeout(350)
const secondShape = await readLastTile()
const jitterRerolled = JSON.stringify(firstShape) !== JSON.stringify(secondShape)

// 5. 对齐 + 导出
await page.getByRole('button', { name: '对齐', exact: true }).click()
await page.waitForTimeout(110)
await page.screenshot({ path: '.shots/06-align-glide.png' })
await page.waitForTimeout(400)
await page.screenshot({ path: '.shots/04-aligned.png' })

const geometryAfterAlign = await readGeometry()
const sameShapeAfterAlign = geometryAfterAlign.matched
const countsAfterAlign = {
  holes: await page.locator('.hole').count(),
  tiles: await page.locator('.tile').count(),
}

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.getByRole('button', { name: '导出 PNG' }).click(),
])
await download.saveAs('.shots/05-export.png')

await page.getByRole('button', { name: '1 : 1' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: '.shots/06-square.png' })

// 7. 点击取字的飞行过程：中途纸片未入场，落地后才出现
const beforeFlight = await page.locator('.tile').count()
await page.locator(`.glyph[data-id="${ids[40]}"]`).click()
await page.waitForTimeout(130)
await page.screenshot({ path: '.shots/07-punch-flight.png' })
const duringFlight = await page.locator('.tile').count()
await page.waitForTimeout(380)
const afterFlight = await page.locator('.tile').count()

// 8. 全部放回原文 + 撤销恢复
const beforeReset = await page.locator('.tile').count()
await page.getByRole('button', { name: '全部放回原文' }).click()
await page.waitForTimeout(400)
const resetState = {
  tiles: await page.locator('.tile').count(),
  holes: await page.locator('.hole').count(),
  glyphs: await page.locator('.glyph').count(),
}
await page.getByRole('button', { name: '撤销', exact: true }).click()
await page.waitForTimeout(400)
const afterUndoReset = await page.locator('.tile').count()

console.log(
  JSON.stringify(
    {
      tilesAfterClick,
      overlapping,
      beforeFlight,
      duringFlight,
      afterFlight,
      beforeReset,
      resetState,
      afterUndoReset,
      tilesAfterDrop,
      dropDeltaPx: Math.round(dropDelta),
      tilesAfterReturnClick,
      tilesAfterDragBack,
      sameShape,
      sameShapeAfterAlign,
      geometryAfterAlign,
      countsAfterAlign,
      fontSizeProbe,
      jitterRerolled,
      firstShape,
      secondShape,
      geometryAfterClick,
      errors,
    },
    null,
    2,
  ),
)

await browser.close()
