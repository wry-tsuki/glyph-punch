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
const tilesAfterClick = await page.locator('.tile').count()

const readGeometry = () =>
  page.evaluate(() => {
    const pick = (selector) =>
      [...document.querySelectorAll(selector)].slice(0, 3).map((node) => ({
        rot: node.style.transform,
        w: node.style.width,
      }))
    return { holes: pick('.hole'), tiles: pick('.tile') }
  })

const geometryAfterClick = await readGeometry()
const sameShape = JSON.stringify(geometryAfterClick.holes) === JSON.stringify(geometryAfterClick.tiles)

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

// 5. 对齐 + 导出
await page.getByRole('button', { name: '对齐', exact: true }).click()
await page.waitForTimeout(110)
await page.screenshot({ path: '.shots/06-align-glide.png' })
await page.waitForTimeout(400)
await page.screenshot({ path: '.shots/04-aligned.png' })

const geometryAfterAlign = await readGeometry()
const sameShapeAfterAlign =
  JSON.stringify(geometryAfterAlign.holes) === JSON.stringify(geometryAfterAlign.tiles)

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.getByRole('button', { name: '导出 PNG' }).click(),
])
await download.saveAs('.shots/05-export.png')

await page.getByRole('button', { name: '1 : 1' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: '.shots/06-square.png' })

console.log(
  JSON.stringify(
    {
      tilesAfterClick,
      tilesAfterDrop,
      dropDeltaPx: Math.round(dropDelta),
      tilesAfterReturnClick,
      tilesAfterDragBack,
      sameShape,
      sameShapeAfterAlign,
      geometryAfterClick,
      errors,
    },
    null,
    2,
  ),
)

await browser.close()
