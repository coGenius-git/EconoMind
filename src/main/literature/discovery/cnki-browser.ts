import { chromium, type BrowserContext, type Page } from 'playwright'
import { join } from 'node:path'
import { resolveDataRoot } from '../../storage-root'

// CNKI is driven by a real browser through Playwright rather than Electron's own window. The
// embedded WebContents could not render CNKI's sign-in - registration and third-party login came up
// blank and the SMS step never ran - while an ordinary Chromium browser is what those pages are
// built for. The browser comes from the system (Edge or Chrome, see launchContext) and a persistent
// profile keeps the resulting session between runs.
const CNKI_HOME_URL = 'https://www.cnki.net/'
const CNKI_SEARCH_URL = 'https://kns.cnki.net/kns8s/defaultresult/index'
const NAVIGATION_TIMEOUT_MS = 45_000
const SIGN_IN_WAIT_TIMEOUT_MS = 10 * 60_000
const POLL_INTERVAL_MS = 1_000

const profileDirectory = (): string => join(resolveDataRoot(), 'literature', 'cnki-browser-profile')

// CNKI answers an untrusted session by redirecting to /verify/home, which aborts the navigation
// that asked for the search page. The abort is expected — Electron's and Playwright's alike report
// it as a navigation error — and the page still ends up somewhere. The resulting URL is exactly
// what the session check needs to read, so navigation failures are not treated as fatal.
async function navigateBestEffort(page: Page, url: string): Promise<void> {
  await page
    .goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS })
    .catch(() => undefined)
}

// A persistent context owns its profile directory exclusively, so signing in and searching take
// turns: one context is opened, used and closed before the next one starts. While the sign-in
// window is open it holds the profile, and every other entry point must stay away from it — a
// session check that ran during sign-in used to close the window the user was working in.
let context: BrowserContext | null = null
let signInWindowOpen = false
let profileQueue: Promise<void> = Promise.resolve()

const withProfile = <T>(operation: () => Promise<T>): Promise<T> => {
  const pending = profileQueue.then(operation)
  profileQueue = pending.then(
    () => undefined,
    () => undefined
  )
  return pending
}

// The browser is always on screen and always headful. Headless Chromium is itself a signal the
// bot check looks for, and an off-screen window turned out to be unusable: when CNKI answered a
// search with a security check, the prompt appeared where nobody could see or solve it, and the
// search just failed. A visible window makes the progress and any prompt actionable.
// The browser is taken from the system - Edge first, then Chrome - so that using this feature
// never requires downloading a separate browser. Both are ordinary Chromium browsers, which is
// what the sign-in flow needs; Playwright's bundled Chromium is only a last resort.
const BROWSER_CHANNELS = ['msedge', 'chrome'] as const

async function launchContext(): Promise<BrowserContext> {
  if (context) return context
  // The profile remembers the last window position, so it is stated on every launch.
  const args = ['--window-position=120,120']
  let failure: unknown
  for (const channel of [...BROWSER_CHANNELS, undefined]) {
    try {
      const opened = await chromium.launchPersistentContext(profileDirectory(), {
        ...(channel ? { channel } : {}),
        headless: false,
        args,
        viewport: { width: 1280, height: 900 },
        locale: 'zh-CN'
      })
      opened.once('close', () => {
        if (context === opened) context = null
      })
      context = opened
      return opened
    } catch (error) {
      failure = error
    }
  }
  throw new Error(
    'No usable browser was found. Install Microsoft Edge or Google Chrome, or run ' +
      `"node node_modules/playwright/cli.js install chromium". Last error: ${
        failure instanceof Error ? failure.message : String(failure)
      }`
  )
}

async function closeContext(): Promise<void> {
  if (!context) return
  const current = context
  context = null
  await current.close().catch(() => undefined)
}

export type CnkiSignInState = { signedIn: boolean; message: string }

async function openCnkiPage(url: string): Promise<Page> {
  const opened = await launchContext()
  const page = opened.pages()[0] ?? (await opened.newPage())
  await navigateBestEffort(page, url)
  return page
}

// Opens a visible Chromium window on the CNKI sign-in page and resolves once the user closes it.
async function openCnkiSignInInternal(): Promise<CnkiSignInState> {
  let opened: BrowserContext
  let target: Page
  try {
    signInWindowOpen = true
    target = await openCnkiPage(PROBE_URL)
    opened = context!
  } catch (error) {
    signInWindowOpen = false
    return {
      signedIn: false,
      message: `Unable to start the browser: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  // Open the search page, not the login page: CNKI answers an untrusted session with a slider
  // captcha there, and sliding it once is what makes later unattended searches work. Signing in,
  // if it is needed at all, happens on the way.
  if (!target.url().includes('cnki.net')) await navigateBestEffort(target, CNKI_HOME_URL)
  // The browser itself is the authority on when the user is done: closing the window closes the
  // context. Polling the page list misread a moment without pages as "user finished", which shut
  // the window down mid-captcha.
  await new Promise<void>((resolve) => {
    const finish = (): void => {
      clearInterval(ticker)
      clearTimeout(deadline)
      resolve()
    }
    const ticker = setInterval(() => {
      void (async () => {
        if (target.isClosed()) {
          finish()
          return
        }
      })()
    }, POLL_INTERVAL_MS)
    const deadline = setTimeout(finish, SIGN_IN_WAIT_TIMEOUT_MS)
    opened.once('close', finish)
  })
  await closeContext()
  signInWindowOpen = false
  return readCnkiSignInStateInternal()
}

async function signOutCnkiInternal(): Promise<CnkiSignInState> {
  try {
    const fresh = await launchContext()
    await fresh.clearCookies()
  } catch (error) {
    return {
      signedIn: false,
      message: `Unable to clear the CNKI session: ${
        error instanceof Error ? error.message : String(error)
      }`
    }
  } finally {
    await closeContext()
  }
  return { signedIn: false, message: 'The CNKI session was cleared.' }
}

// Matching link text proved unreliable: the CNKI home page exposes neither a "sign in" nor a
// "sign out" anchor, so both lists come back empty and the verdict carries no information. The
// reliable question is whether CNKI keeps you on a page that requires an account: when there is no
// session it redirects to its login or verification flow instead.
const LOGIN_REDIRECT_PATTERN = /login|passport|verify|sso|signin|checkcode/i
// A signed-in page shows the account name and a way out; either is enough once no redirect fired.
const SIGNED_IN_TEXT = /退出|注销|安全退出|我的知网|个人中心|机构馆/

const PROBE_URL = `${CNKI_SEARCH_URL}?kw=%E7%BB%BF%E8%89%B2%E9%87%91%E8%9E%8D&korder=SU`

const TEXT_PROBE = `(() => ({
  url: location.href,
  title: document.title || '',
  text: (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 600)
}))()`

type TextProbe = { url: string; title: string; text: string }

// Asks the site itself rather than a cookie: CNKI writes client and provider cookies before any
// sign-in, so both cookie names and their values were present while the account was signed out.
async function readCnkiSignInStateInternal(): Promise<CnkiSignInState> {
  if (signInWindowOpen)
    return { signedIn: false, message: 'The CNKI sign-in window is still open.' }
  try {
    const page = await openCnkiPage(PROBE_URL)
    await page.waitForTimeout(2_000)
    const probe = (await page.evaluate(TEXT_PROBE)) as TextProbe
    await page.close()
    await closeContext()
    const redirected = LOGIN_REDIRECT_PATTERN.test(probe.url)
    if (!/^https:\/\/(?:[^/]+\.)?cnki\.net\//iu.test(probe.url))
      return {
        signedIn: false,
        message: 'CNKI could not be reached. Check the network connection and retry.'
      }
    if (redirected) {
      // The verification page is not a failure to report but a step the user takes once: passing
      // it in the visible browser is what lets later searches run unattended.
      const verification = /verify|captcha|checkcode/i.test(probe.url)
      return {
        signedIn: false,
        message: verification
          ? 'CNKI asked for a security check. Complete it in the browser window, close the window, then search again.'
          : 'CNKI requires sign-in. Sign in in the browser window, then close it.'
      }
    }
    if (SIGNED_IN_TEXT.test(probe.text))
      return { signedIn: true, message: 'A CNKI session is available.' }
    // Public result pages can be available without an account.
    return { signedIn: true, message: 'CNKI public search is available.' }
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
  networkError?: boolean
  detail: string
}

const RESULT_SELECTORS = [
  'table.result-table-list tbody tr',
  '.result-table-list tr',
  '.result-item',
  '.list-item',
  '#gridTable tr',
  '.result-list li',
  '.article-list li'
]
const RESULT_TITLE_SELECTOR =
  'td.name a.fz14, td.name a, .title a, a.title, a.fz14, .doc-title a, a[href*="/kcms/" i], a[href*="/kcms2/" i]'
// Generic .list-item also matches CNKI's hidden filter controls before the result table. Wait
// specifically for a visible row with a paper link, rather than the first generic list element.
const WAIT_SELECTOR = RESULT_SELECTORS.map(
  (selector) => `${selector}:has(${RESULT_TITLE_SELECTOR}):visible`
).join(', ')

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
    const link = node.querySelector(${JSON.stringify(RESULT_TITLE_SELECTOR)})
    if (!link) continue
    const cells = Array.from(node.querySelectorAll('td')).map((cell) => cell.innerText.trim())
    const text = (node.innerText || '').replace(/\\s+/g, ' ').trim()
    const title = (link.textContent || '').trim()
    if (!title || title.length < 2) continue
    rows.push({
      title,
      href: link ? link.href : '',
      authors: (() => { const cell = node.querySelector('td.author, .author, .authors'); if (!cell) return cells[2] || ''; const authors = Array.from(cell.querySelectorAll('a')).map(a => (a.textContent || '').trim()).filter(Boolean); return authors.length ? authors.join(';') : (cell.textContent || '').trim() })(),
      venue: (node.querySelector('td.source, .source, .venue')?.textContent || cells[3] || '').trim(),
      date: (node.querySelector('td.date, .date, .year')?.textContent || cells[4] || cells[5] || '').trim(),
      text
    })
  }
  return { selector: match.selector, rows }
})()`

// Loads the result page in a visible Chromium and walks through up to maxPages pages, reading
// each list straight out of the DOM. Paging stays inside one session: reloading per page would
// multiply the navigation cost by the page count.
async function scrapeCnkiSearchInternal(url: string, maxPages: number): Promise<CnkiScrapeResult> {
  if (signInWindowOpen)
    return {
      rows: [],
      selector: null,
      blocked: false,
      detail: 'the CNKI sign-in window is still open'
    }
  try {
    const target = await openCnkiPage(url)
    if (!/^https:\/\/(?:[^/]+\.)?cnki\.net\//iu.test(target.url())) {
      await closeContext()
      return {
        rows: [],
        selector: null,
        blocked: false,
        networkError: true,
        detail: 'CNKI could not be reached. Check the network or proxy settings and retry.'
      }
    }
    const found = await target
      .waitForSelector(WAIT_SELECTOR, { timeout: RESULT_WAIT_MS })
      .then(() => true)
      .catch(() => false)
    if (!found) {
      const probe = (await target.evaluate(TEXT_PROBE)) as TextProbe
      const blocked =
        LOGIN_REDIRECT_PATTERN.test(probe.url) ||
        /请完成安全验证|验证码|访问受限|非法请求/u.test(probe.text)
      const detail = blocked
        ? 'Complete the CNKI security check or sign-in in the browser window, then search again.'
        : 'CNKI did not show a recognized result list. Export references from CNKI and import the file here.'
      if (!blocked) await closeContext()
      return {
        rows: [],
        selector: null,
        blocked,
        detail
      }
    }
    const first = (await target.evaluate(EXTRACT_SCRIPT)) as {
      selector: string | null
      rows: CnkiScrapeResult['rows']
    }
    const rows = [...first.rows]
    let previous = first.rows.map((row) => row.href || row.title).join('|')
    const detail = 'CNKI search completed.'
    // Collect the following pages in the same session until the list runs out or the page budget
    // is spent.
    for (let step = 1; step < maxPages; step += 1) {
      const advanced = await target
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
      if (advanced !== true) break
      await target.waitForTimeout(2_000)
      const next = (await target.evaluate(EXTRACT_SCRIPT).catch(() => null)) as {
        selector: string | null
        rows: CnkiScrapeResult['rows']
      } | null
      if (!next || !next.rows.length) break
      const fingerprint = next.rows.map((row) => row.href || row.title).join('|')
      if (fingerprint === previous) break
      previous = fingerprint
      rows.push(...next.rows)
    }
    await target.close()
    await closeContext()
    return {
      rows,
      selector: first.selector,
      blocked: false,
      detail
    }
  } catch (error) {
    await closeContext()
    return {
      rows: [],
      selector: null,
      blocked: false,
      networkError: true,
      detail: error instanceof Error ? error.message : String(error)
    }
  }
}

const RESULT_WAIT_MS = 60_000

// All entry points share one owner, including launch time and cookie clearing. A later request
// cannot close a browser held by an earlier search or by the user's sign-in flow.
export const openCnkiSignIn = (): Promise<CnkiSignInState> => withProfile(openCnkiSignInInternal)
export const signOutCnki = (): Promise<CnkiSignInState> => withProfile(signOutCnkiInternal)
export const readCnkiSignInState = (): Promise<CnkiSignInState> =>
  withProfile(readCnkiSignInStateInternal)
export const scrapeCnkiSearch = (url: string, maxPages: number): Promise<CnkiScrapeResult> =>
  withProfile(() => scrapeCnkiSearchInternal(url, maxPages))

export { CNKI_HOME_URL, CNKI_SEARCH_URL }
