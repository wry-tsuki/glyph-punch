import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

function findBrowser() {
  const found = CANDIDATES.find((path) => existsSync(path))
  if (!found) {
    throw new Error('未找到 Chrome/Edge。请用 CHROME_PATH 指向浏览器可执行文件。')
  }
  return found
}

async function assertServer() {
  try {
    const response = await fetch(BASE_URL)
    if (!response.ok) throw new Error(String(response.status))
  } catch {
    throw new Error(`无法访问 ${BASE_URL}，请先运行 npm run dev。`)
  }
}

export async function openApp(viewport = { width: 1600, height: 1000 }) {
  await assertServer()
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true })
  const page = await browser.newPage({ viewport })
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  return { browser, page }
}
