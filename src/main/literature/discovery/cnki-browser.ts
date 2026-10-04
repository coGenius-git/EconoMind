import { chromium, type BrowserContext, type Page } from 'playwright'
import { join } from 'node:path'
import { resolveDataRoot } from '../../storage-root'

// CNKI is driven by a standalone Chromium (Playwright) rather than Electron's own window. The
// embedded WebContents could not render CNKI's sign-in: registration and third-party login came up
// blank and the SMS step never ran. A stock Chromium is what those pages are built for, and a
// persistent profile keeps the resulting session between runs.
const CNKI_HOME_URL = 'https://www.cnki.net/'
const CNKI_SIGN_IN_URL = 'https://login.cnki.net/?platform=kns'
const NAVIGATION_TIMEOUT_MS = 45_000
const SIGN_IN_WAIT_TIMEOUT_MS = 10 * 60_000
const POLL_INTERVAL_MS = 1_000

const profileDirectory = (): string => join(resolveDataRoot(), 'literature', 'cnki-browser-profile')

// A persistent context owns its profile directory exclusively, so signing in and searching take
// turns: one context is opened, used and closed before the next one starts.
let context: BrowserContext | null = null

async function launchContext(headless: boolean): Promise<BrowserContext> {
  if (context) return context
  context = await chromium.launchPersistentContext(profileDirectory(), {
    headless,
    // A real browser profile, not a test harness: the visible window is only for signing in.
    args: ['--disable-blink-features=AutomationControlled'],
    viewport: { width: 1280, height: 900 },
    locale: 'zh-CN'
  })
  return context
}

async function closeContext(): Promise<void> {
  if (!context) return
  const current = context
  context = null
  await current.close().catch(() => undefined)
}

export type CnkiSignInState = { signedIn: boolean; message: string }

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Opens a visible Chromium window on the CNKI sign-in page and resolves once the user closes it.
export async function openCnkiSignIn(): Promise<CnkiSignInState> {
  let opened: BrowserContext
  try {
    opened = await launchContext(false)
  } catch (error) {
    return {
      signedIn: false,
      message: `Unable to start the browser: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  const page = opened.pages()[0] ?? (await opened.newPage())
  await page.goto(CNKI_SIGN_IN_URL, { timeout: NAVIGATION_TIMEOUT_MS }).catch(async () => {
    await page.goto(CNKI_HOME_URL, { timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined)
  })
  // The user signs in by hand; closing every tab is the signal that they are done.
  const deadline = Date.now() + SIGN_IN_WAIT_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (opened.pages().every((entry) => entry.isClosed())) break
    await sleep(POLL_INTERVAL_MS)
  }
  await closeContext()
  return readCnkiSignInState()
}

export async function signOutCnki(): Promise<CnkiSignInState> {
  const opened = context
  if (opened) await closeContext()
  try {
    const fresh = await chromium.launchPersistentContext(profileDirectory(), { headless: true })
    await fresh.clearCookies()
    await fresh.close()
  } catch (error) {
    return {
      signedIn: false,
      message: `Unable to clear the CNKI session: ${
        error instanceof Error ? error.message : String(error)
      }`
    }
  }
  return { signedIn: false, message: 'The CNKI session was cleared.' }
}

const SIGNED_OUT_LABELS = ['登录', '登录/注册', '请登录', '注册', '登入', '登录/註冊']
const SIGNED_IN_LABELS = ['退出', '退出登录', '安全退出', '注销', '登出']

const HOME_PROBE = `(() => {
  const labels = Array.from(document.querySelectorAll('a'))
    .map((el) => (el.innerText || '').trim())
    .filter(Boolean)
  const out = ${JSON.stringify(SIGNED_OUT_LABELS)}
  const into = ${JSON.stringify(SIGNED_IN_LABELS)}
  return {
    url: location.href,
    title: document.title || '',
    logout: labels.filter((label) => into.includes(label)).slice(0, 3),
    login: labels.filter((label) => out.includes(label)).slice(0, 3)
  }
})()`

type HomeProbe = { url: string; title: string; logout: string[]; login: string[] }

// Asks the page rather than a cookie: CNKI writes client and provider cookies before any sign-in,
// so both the names and their values were present while the account was signed out.
export async function readCnkiSignInState(): Promise<CnkiSignInState> {
  try {
    const opened = await launchContext(true)
    const page = await opened.newPage()
    await page.goto(CNKI_HOME_URL, { timeout: NAVIGATION_TIMEOUT_MS })
    const probe = (await page.evaluate(HOME_PROBE)) as HomeProbe
    await page.close()
    await closeContext()
    const detail = `url=${probe.url} title=${probe.title} logout=[${probe.logout.join('|')}] login=[${probe.login.join('|')}]`
    return probe.logout.length > 0 && probe.login.length === 0
      ? { signedIn: true, message: `A CNKI session is available. ${detail}` }
      : { signedIn: false, message: `No CNKI sign-in detected. ${detail}` }
  } catch (error) {
    await closeContext()
    return {
      signedIn: false,
      message: `Unable to check the CNKI session: ${
        error instanceof Error ? error.message : String(error)
      }`
    }
  }
}

export type CnkiScrapeResult = {
  rows: Array<{
    title: string
    href: string
    authors: string
    venue: string
    date: string
    text: string
  }>
  selector: string | null
  blocked: boolean
  detail: string
}

const RESULT_SELECTORS = [
  'table.result-table-list tbody tr',
  '.result-table-list tr',
  '.result-item',
  '.list-item',
  '#gridTable tr'
]
const WAIT_SELECTOR =
  'table.result-table-list, .result-table-list, .result-item, .list-item, #gridTable'
const BLOCKED_PATTERN = /login|登录|验证码|安全验证|访问受限|非法请求/u

const EXTRACT_SCRIPT = `(() => {
  const selectors = ${JSON.stringify(RESULT_SELECTORS)}
  let match = null
  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector))
    if (nodes.length) { match = { selector, nodes }; break }
  }
  if (!match) return { selector: null, rows: [] }
  const rows = []
  for (const node of match.nodes) {
    const link = node.querySelector('a')
    const cells = Array.from(node.querySelectorAll('td')).map((cell) => cell.innerText.trim())
    const text = (node.innerText || '').replace(/\\s+/g, ' ').trim()
    const title = (link && link.innerText.trim()) || cells[1] || text.slice(0, 300)
    if (!title || title.length < 2) continue
    rows.push({
      title,
      href: link ? link.href : '',
      authors: cells[2] || '',
      venue: cells[3] || '',
      date: cells[4] || cells[5] || '',
      text
    })
  }
  return { selector: match.selector, rows }
})()`

// Loads the result page once in a hidden Chromium and walks through up to maxPages pages, reading
// each list straight out of the DOM. Paging stays inside one session: reloading per page would
// multiply the navigation cost by the page count.
export async function scrapeCnkiSearch(url: string, maxPages: number): Promise<CnkiScrapeResult> {
  try {
    const opened = await launchContext(true)
    const target = (await opened.newPage()) as Page
    await target.goto(url, { timeout: NAVIGATION_TIMEOUT_MS })
    const found = await target
      .waitForSelector(WAIT_SELECTOR, { timeout: RESULT_WAIT_MS })
      .then(() => true)
      .catch(() => false)
    if (!found) {
      const detail = `url=${target.url()} title=${await target.title()}`
      await target.close()
      await closeContext()
      return {
        rows: [],
        selector: null,
        blocked: BLOCKED_PATTERN.test(detail),
        detail
      }
    }
    const first = (await target.evaluate(EXTRACT_SCRIPT)) as {
      selector: string | null
      rows: CnkiScrapeResult['rows']
    }
    const rows = [...first.rows]
    const detail = `url=${target.url()} title=${await target.title()}`
    // Collect the following pages in the same session until the list runs out or the page budget
    // is spent.
    for (let step = 1; step < maxPages; step += 1) {
      const advanced: boolean = await target
        .evaluate(
          `(() => {
          const next = document.querySelector('#PageNext') || document.querySelector('.page-next') ||
            document.querySelector('a.next') || document.querySelector('#page_next')
          if (!next) return false
          next.click()
          return true
        })()`
        )
        .catch(() => false)
      if (!advanced) break
      await target.waitForTimeout(2_000)
      const next = (await target.evaluate(EXTRACT_SCRIPT).catch(() => null)) as {
        selector: string | null
        rows: CnkiScrapeResult['rows']
      } | null
      if (!next || !next.rows.length) break
      rows.push(...next.rows)
    }
    await target.close()
    await closeContext()
    return {
      rows,
      selector: first.selector,
      blocked: BLOCKED_PATTERN.test(detail),
      detail
    }
  } catch (error) {
    await closeContext()
    return {
      rows: [],
      selector: null,
      blocked: false,
      detail: error instanceof Error ? error.message : String(error)
    }
  }
}

const RESULT_WAIT_MS = 60_000

export const CNKI_SEARCH_URL = 'https://kns.cnki.net/kns8s/defaultresult/index'
export { CNKI_HOME_URL }
