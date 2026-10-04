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

// Most cookies below exist before sign-in as well (CNKI writes client and fingerprint cookies on
// first visit), so a name alone proves nothing. Only these two carry the sign-in state itself,
// and the value decides; CNKI spells the first one "loginstuts".
const SIGN_IN_STATE_COOKIES: readonly string[] = ['ecp_loginstuts', 'ecp_loginstatus']
const SIGNED_OUT_VALUES = new Set(['', '0', 'false', 'null', 'undefined', 'none'])
// Shown with their values when no session is detected, so the real sign-in cookie can be
// identified from an actual session instead of guessed.
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

function ensureWindow(options: { visible: boolean }): BrowserWindow {
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

export async function getCnkiSignInState(): Promise<CnkiSignInState> {
  try {
    const cookies = await getSession().cookies.get({})
    const state = cookies
      .filter((cookie) => SIGN_IN_STATE_COOKIES.includes(cookie.name.toLowerCase()))
      .find((cookie) => !SIGNED_OUT_VALUES.has(cookie.value.trim().toLowerCase()))
    if (state)
      return {
        signedIn: true,
        message: `A CNKI session is available (${state.name}=${state.value.trim()}).`
      }
    const byName = new Map(
      cookies.map((cookie) => [cookie.name.toLowerCase(), cookie.value.trim()])
    )
    // Handles only the state cookies keep their value in the message: the others hold credentials
    // that must not travel into the UI.
    const diagnosis = DIAGNOSTIC_COOKIES.map(
      (name) => `${name}=${(byName.get(name) ?? '<absent>').slice(0, 24)}`
    ).join(', ')
    return {
      signedIn: false,
      message: cookies.length
        ? `No CNKI sign-in detected. ${diagnosis} | ${cookies.length} cookies in session`
        : 'The CNKI session is empty. Sign in from the CNKI window first.'
    }
  } catch (error) {
    return { signedIn: false, message: `Unable to read the CNKI session: ${String(error)}` }
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
