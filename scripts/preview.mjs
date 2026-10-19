import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const ids = await page.locator('.glyph').evaluateAll((nodes) =>
  nodes.map((node) => node.getAttribute('data-id')),
)
const picks = [2, 5, 9, 13, 19, 23, 28, 34, 39, 44, 51, 57]
for (const index of picks) {
  await page.locator(`.glyph[data-id="${ids[index]}"]`).click()
  await page.waitForTimeout(60)
}
await page.getByRole('button', { name: '对齐', exact: true }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'docs/preview.png' })
await browser.close()
console.log('saved docs/preview.png')
