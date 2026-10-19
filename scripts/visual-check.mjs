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
await page.waitForTimeout(600)
await page.screenshot({ path: '.shots/01-initial.png' })

const ids = await page
  .locator('.glyph')
  .evaluateAll((nodes) => nodes.slice(0, 8).map((node) => node.getAttribute('data-id')))

for (const id of ids) {
  await page.locator(`.glyph[data-id="${id}"]`).click()
  await page.waitForTimeout(80)
}
await page.waitForTimeout(500)
await page.screenshot({ path: '.shots/02-punched.png' })

const firstTile = page.locator('.tile').first()
const tileBox = await firstTile.boundingBox()
const boardBox = await page.locator('.board').boundingBox()
if (tileBox && boardBox) {
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(tileBox.x + 220, tileBox.y - 260, { steps: 12 })
  await page.screenshot({ path: '.shots/03-dragging.png' })
  await page.mouse.up()
  await page.waitForTimeout(400)
}
await page.screenshot({ path: '.shots/04-returned.png' })

const tilesLeft = await page.locator('.tile').count()
const holesLeft = await page.locator('.hole').count()

await page.getByRole('button', { name: '对齐', exact: true }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: '.shots/05-aligned.png' })

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.getByRole('button', { name: '导出 PNG' }).click(),
])
await download.saveAs('.shots/06-export.png')

await page.getByRole('button', { name: '1 : 1' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: '.shots/07-square.png' })

await page.getByRole('button', { name: '两端' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: '.shots/08-justify.png' })

await page.getByRole('button', { name: '思源宋体' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: '.shots/09-noto.png' })
const activeFont = await page
  .locator('.glyph')
  .first()
  .evaluate((node) => getComputedStyle(node).fontFamily)

console.log(JSON.stringify({ tilesLeft, holesLeft, errors, activeFont }, null, 2))

const metrics = await page.evaluate(() => {
  const board = document.querySelector('.board')
  const glyph = document.querySelector('.glyph')
  const tile = document.querySelector('.tile')
  const rect = board?.getBoundingClientRect()
  return {
    board: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
    glyphTop: glyph instanceof HTMLElement ? glyph.style.top : null,
    tile: tile instanceof HTMLElement ? { top: tile.style.top, left: tile.style.left } : null,
  }
})
console.log(JSON.stringify(metrics, null, 2))
await browser.close()
