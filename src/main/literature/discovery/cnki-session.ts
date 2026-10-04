import { BrowserWindow, session as electronSession } from 'electron'

// CNKI has no public search API and its result pages require an authenticated (often
// institution-backed) session. The integration therefore drives a dedicated Electron window with
// its own persistent partition: the user signs in once, the cookies stay in that partition, and
// later searches run in a hidden window that reuses the same session.
//
// The URLs and DOM selectors below are the part most likely to change when CNKI updates its site.
// They are deliberately grouped here so a single edit re-targets every caller. Verify them in the
// running app before relying on the results.

const CNKI_PARTITION = 'persist:cnki-discovery'
const CNKI_HOME_URL = 'https://www.cnki.net/'
const CNKI_SIGN_IN_URL = 'https://login.cnki.net/?platform=kns'
const WINDOW_CLOSE_TIMEOUT_MS = 10 * 60_000

// CNKI pages keep long-lived connections open, so "the page finished loading" is not a usable
// readiness signal and waiting for it times out on pages that are already readable. Loading is
// therefore best effort with its own budget, and readiness is decided by the result list itself.
const PAGE_LOAD_BUDGET_MS = 45_000
const RESULT_WAIT_BUDGET_MS = 90_000
const POLL_INTERVAL_MS = 500

// Cookie names proved unusable for this: CNKI writes client, fingerprint and provider cookies
// before any sign-in, so both the name and the value of "ecp_loginstuts" were present while the
// account was still signed out. Sign-in state is therefore read from the page itself, which shows
// "login | register" when signed out and the account name plus "sign out" when signed in.
const SIGNED_OUT_LABELS = ['登录', '登录/注册', '请登录', '注册', '登入', '登录/註冊']
const SIGNED_IN_LABELS = ['退出', '退出登录', '安全退出', '注销', '登出']

const HOME_PROBE_SCRIPT = `(() => {
  const labels = Array.from(document.querySelectorAll('a'))
    .map((el) => (el.innerText || '').trim())
    .filter(Boolean)
  const { SIGNED_OUT_LABELS: out, SIGNED_IN_LABELS: into } = ${JSON.stringify({
    SIGNED_OUT_LABELS,
    SIGNED_IN_LABELS
  })}
  return {
    url: location.href,
    title: document.title || '',
    logout: labels.filter((label) => into.includes(label)).slice(0, 3),
    login: labels.filter((label) => out.includes(label)).slice(0, 3)
  }
})()`

// Reported alongside the probe so a wrong verdict still carries the evidence needed to fix it.
const DIAGNOSTIC_COOKIES: readonly string[] = [
  'ecp_loginstuts',
  'ecp_loginstatus',
  'ui',
  'qlogin_uid',
  'c_m_linid'
]

// The window identifies as Chrome. Third-party sign-in providers (QQ, WeChat) reject a client
// whose User-Agent advertises Electron, which is what leaves their pages blank.
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${
  process.versions.chrome?.split('.')[0] ?? '141'
}.0.0.0 Safari/537.36`

export type CnkiSignInState = { signedIn: boolean; message: string }

let window: BrowserWindow | null = null

function getSession(): Electron.Session {
  return electronSession.fromPartition(CNKI_PARTITION)
}

let sessionFixesInstalled = false

// Chromium blocks third-party cookies by default. The QQ and WeChat sign-in popups store cookies
// on their own domains and use them cross-site, and without them those pages come back blank.
// The rewrite is scoped to this partition; the site still decides what a cookie contains.
function installSessionFixes(): void {
  if (sessionFixesInstalled) return
  sessionFixesInstalled = true
  getSession().webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders ?? {}
    const key =
      'set-cookie' in headers ? 'set-cookie' : 'Set-Cookie' in headers ? 'Set-Cookie' : null
    const setCookie = key ? headers[key] : undefined
    if (!key || !Array.isArray(setCookie)) {
      callback({ responseHeaders: headers })
      return
    }
    callback({
      responseHeaders: {
        ...headers,
        [key]: setCookie.map((value: string) =>
          /;\s*samesite=/iu.test(value) ? value : `${value}; SameSite=None`
        )
      }
    })
  })
}

function ensureWindow(options: { visible: boolean }): BrowserWindow {
  installSessionFixes()
  if (window && !window.isDestroyed()) {
    if (options.visible) {
      window.show()
      window.focus()
    }
    return window
  }
  // Applies to every request in the partition, including popups opened by a sign-in provider.
  getSession().setUserAgent(CHROME_UA)
  const created = new BrowserWindow({
    show: options.visible,
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      partition: CNKI_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      // The sign-in page is an ordinary web page, but a sandboxed renderer blocks parts of the
      // legacy flows CNKI uses for account and institutional sign-in, which makes its buttons
      // appear inert. The window is a browser surface, so it runs unsandboxed.
      sandbox: false,
      // Electron throttles hidden windows by default, which stalls both the page load and the
      // script that reads the result list.
      backgroundThrottling: false
    }
  })
  // Institutional and third-party sign-in open a popup. Keep it in the same partition so the
  // cookies it writes belong to the session this integration reads.
  created.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      autoHideMenuBar: true,
      webPreferences: {
        partition: CNKI_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false
      }
    }
  }))
  // The menu bar is hidden, so F12 is the only way to inspect a page that misbehaves.
  created.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      created.webContents.toggleDevTools()
      event.preventDefault()
    }
  })
  created.on('closed', () => {
    window = null
  })
  window = created
  return created
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Navigation with its own budget. Returns false only when the window rejected the URL outright; a
// page that is merely still loading counts as usable, because CNKI keeps connections open and an
// unbounded wait here would leave the caller pending forever. Readiness is decided by the caller
// looking for the result list.
async function loadWithBudget(
  target: BrowserWindow,
  url: string,
  budgetMs: number
): Promise<boolean> {
  const navigation = target.loadURL(url)
  // Keep the rejection observed even when the budget wins the race.
  navigation.catch(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  const outcome = await Promise.race([
    navigation.then(
      () => 'loaded' as const,
      () => 'failed' as const
    ),
    new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), budgetMs)
    })
  ])
  if (timer) clearTimeout(timer)
  return outcome !== 'failed'
}

// Tries each URL in order, stopping at the first one the window accepts.
async function loadFirstAvailable(target: BrowserWindow, urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    if (await loadWithBudget(target, url, PAGE_LOAD_BUDGET_MS)) return
  }
}

export async function openCnkiSignIn(): Promise<CnkiSignInState> {
  let target: BrowserWindow
  try {
    target = ensureWindow({ visible: true })
  } catch (error) {
    return {
      signedIn: false,
      message: `Unable to create the CNKI window: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  const closed = new Promise<void>((resolve) => {
    if (target.isDestroyed()) {
      resolve()
      return
    }
    target.once('closed', () => resolve())
  })
  // Neither candidate loading is not fatal: the window is visible and the user can navigate it.
  await loadFirstAvailable(target, [CNKI_SIGN_IN_URL, CNKI_HOME_URL])
  // The window stays open while the user signs in. The session only exists once they are done, so
  // the state is read after the window closes (or after the budget runs out) instead of at open.
  await Promise.race([
    closed,
    new Promise<void>((resolve) => setTimeout(resolve, WINDOW_CLOSE_TIMEOUT_MS))
  ])
  return getCnkiSignInState()
}

export async function closeCnkiWindow(): Promise<void> {
  if (window && !window.isDestroyed()) window.close()
  window = null
}

async function readCookieDiagnosis(): Promise<string> {
  try {
    const cookies = await getSession().cookies.get({})
    if (!cookies.length) return 'session empty'
    const byName = new Map(
      cookies.map((cookie) => [cookie.name.toLowerCase(), cookie.value.trim()])
    )
    // Only these keep their value in the message: the others hold credentials that must not
    // travel into the UI.
    return DIAGNOSTIC_COOKIES.map(
      (name) => `${name}=${(byName.get(name) ?? '<absent>').slice(0, 24)}`
    ).join(', ')
  } catch (error) {
    return `cookies unreadable: ${error instanceof Error ? error.message : String(error)}`
  }
}

type HomeProbe = { url: string; title: string; logout: string[]; login: string[] }

// Asks the page itself instead of a cookie: a signed-out CNKI page advertises the login entry, a
// signed-in one advertises signing out.
async function probeSignInState(): Promise<{ signedIn: boolean; detail: string }> {
  const target = ensureWindow({ visible: false })
  // Reuse the page the user just signed in on when the window is still open.
  const currentUrl = target.isDestroyed() ? '' : target.webContents.getURL()
  if (!currentUrl.includes('cnki.net')) {
    await loadWithBudget(target, CNKI_HOME_URL, PAGE_LOAD_BUDGET_MS)
    const loadedUrl = target.isDestroyed() ? '' : target.webContents.getURL()
    if (!loadedUrl.includes('cnki.net'))
      return { signedIn: false, detail: `CNKI was not reachable (url=${loadedUrl || '<blank>'})` }
  }
  const probe = (await target.webContents.executeJavaScript(HOME_PROBE_SCRIPT, true)) as HomeProbe
  const detail =
    `url=${probe.url} title=${probe.title} ` +
    `logout=[${probe.logout.join('|')}] login=[${probe.login.join('|')}]`
  return { signedIn: probe.logout.length > 0 && probe.login.length === 0, detail }
}

export async function getCnkiSignInState(): Promise<CnkiSignInState> {
  let probe: { signedIn: boolean; detail: string }
  try {
    probe = await probeSignInState()
  } catch (error) {
    return {
      signedIn: false,
      message: `Unable to check the CNKI session: ${
        error instanceof Error ? error.message : String(error)
      } | ${await readCookieDiagnosis()}`
    }
  }
  return probe.signedIn
    ? { signedIn: true, message: `A CNKI session is available. ${probe.detail}` }
    : {
        signedIn: false,
        message: `No CNKI sign-in detected. ${probe.detail} | ${await readCookieDiagnosis()}`
      }
}

export async function signOutCnki(): Promise<CnkiSignInState> {
  try {
    await getSession().clearStorageData({ storages: ['cookies', 'localstorage'] })
  } catch {
    // A failed cleanup still leaves the window closed; report the resulting state.
  }
  await closeCnkiWindow()
  return { signedIn: false, message: 'The CNKI session was cleared.' }
}

export type CnkiPageLoad = {
  title: string
  url: string
  html: string
}

async function pollForSelector(
  target: BrowserWindow,
  selector: string,
  signal: AbortSignal | undefined,
  budgetMs: number
): Promise<boolean> {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('The CNKI request was cancelled.')
    if (target.isDestroyed()) throw new Error('The CNKI window was closed.')
    const found = await target.webContents
      .executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(selector)}))`, true)
      .catch(() => false)
    if (found) return true
    await sleep(POLL_INTERVAL_MS)
  }
  return false
}

// Parsing happens in the page context where the DOM APIs are available; only plain data crosses
// back into the main process.
export async function evaluateInCnkiWindow<Value>(script: string): Promise<Value> {
  const target = ensureWindow({ visible: false })
  return (await target.webContents.executeJavaScript(script, true)) as Value
}

// Loads a URL in the hidden CNKI window, waits for the result list, then extracts with the script.
export async function evaluateOnCnkiPage<Value>(
  url: string,
  script: string,
  options: { signal?: AbortSignal; waitForSelector?: string; timeoutMs?: number } = {}
): Promise<Value> {
  const target = ensureWindow({ visible: false })
  await loadWithBudget(target, url, PAGE_LOAD_BUDGET_MS)
  options.signal?.throwIfAborted()
  const selector = options.waitForSelector
  if (selector) {
    const budgetMs = options.timeoutMs ?? RESULT_WAIT_BUDGET_MS
    const found = await pollForSelector(target, selector, options.signal, budgetMs)
    if (!found)
      throw new Error(`The CNKI result list did not appear within ${Math.round(budgetMs / 1000)}s.`)
  }
  return evaluateInCnkiWindow<Value>(script)
}

// Advances the result list by clicking the next-page control, when the current page exposes one.
export async function clickCnkiNextPage(options: { signal?: AbortSignal } = {}): Promise<boolean> {
  const target = ensureWindow({ visible: false })
  if (target.isDestroyed()) return false
  const clicked = await target.webContents.executeJavaScript(
    `(() => {
      const next = document.querySelector('#PageNext') || document.querySelector('.page-next') ||
        document.querySelector('a.next') || document.querySelector('#page_next')
      if (!next) return false
      next.click()
      return true
    })()`,
    true
  )
  if (!clicked) return false
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    options.signal?.throwIfAborted()
    await sleep(600)
  }
  return true
}

// A DOM snapshot of the current page, used to diagnose an unrecognised result list.
export async function loadCnkiPage(
  url: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<CnkiPageLoad> {
  const target = ensureWindow({ visible: false })
  await loadWithBudget(target, url, options.timeoutMs ?? PAGE_LOAD_BUDGET_MS)
  options.signal?.throwIfAborted()
  const result = await target.webContents.executeJavaScript(
    `(() => ({ title: document.title || '', url: location.href, html: document.body ? document.body.innerHTML.slice(0, 4_000_000) : '' }))()`,
    true
  )
  return {
    title: String(result?.title ?? ''),
    url: String(result?.url ?? url),
    html: String(result?.html ?? '')
  }
}

export function disposeCnkiSession(): void {
  if (window && !window.isDestroyed()) window.destroy()
  window = null
}

export const CNKI_SIGN_IN_WINDOW_TIMEOUT_MS = WINDOW_CLOSE_TIMEOUT_MS
