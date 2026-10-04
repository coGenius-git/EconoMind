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

// Cookie names observed on an authenticated CNKI session. Any match counts as signed in. The
// sign-in flow spans several CNKI hosts (login.cnki.net / www.cnki.net / kns.cnki.net), so the
// names are matched as substrings against the whole partition rather than one host.
const SIGN_IN_COOKIE_HINTS = [
  'ecp_loginstatus',
  'cnkiuserkey',
  'knsuid',
  'ecp_uid',
  'sid_kns',
  'sid_klogin',
  'sid_knsch',
  'userid'
] as const

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
  const created = new BrowserWindow({
    show: options.visible,
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      partition: CNKI_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The site is loaded as an ordinary web page; no local code is injected into it.
      webSecurity: true
    }
  })
  created.on('closed', () => {
    window = null
  })
  window = created
  return created
}

export async function openCnkiSignIn(): Promise<CnkiSignInState> {
  const target = ensureWindow({ visible: true })
  const closed = new Promise<void>((resolve) => {
    if (target.isDestroyed()) {
      resolve()
      return
    }
    target.once('closed', () => resolve())
  })
  await target.loadURL(CNKI_SIGN_IN_URL).catch(async () => {
    await target.loadURL(CNKI_HOME_URL)
  })
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
    const names = [...new Set(cookies.map((cookie) => cookie.name.toLowerCase()))]
    const matched = SIGN_IN_COOKIE_HINTS.filter((hint) => names.some((name) => name.includes(hint)))
    if (matched.length)
      return { signedIn: true, message: `A CNKI session is available (${matched.join(', ')}).` }
    // Report the cookie names that actually exist so a mis-detected sign-in can be corrected from
    // the real session instead of guessing.
    return {
      signedIn: false,
      message: names.length
        ? `No CNKI sign-in cookie among: ${names.slice(0, 24).join(', ')}`
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

// Loads a URL in the hidden CNKI window and returns a trimmed DOM snapshot for parsing.
export async function loadCnkiPage(
  url: string,
  options: { signal?: AbortSignal; waitForSelector?: string; timeoutMs?: number } = {}
): Promise<CnkiPageLoad> {
  const target = ensureWindow({ visible: false })
  const timeoutMs = options.timeoutMs ?? 30_000
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  await target.loadURL(url)
  if (options.waitForSelector) {
    await waitForSelector(target, options.waitForSelector, signal)
  } else {
    await waitForLoad(target, signal)
  }
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

async function waitForLoad(target: BrowserWindow, signal: AbortSignal): Promise<void> {
  if (!target.webContents.isLoading()) return
  await new Promise<void>((resolve, reject) => {
    const onFinish = (): void => {
      cleanup()
      resolve()
    }
    const onAbort = (): void => {
      cleanup()
      reject(new Error('CNKI page load was interrupted.'))
    }
    const cleanup = (): void => {
      target.webContents.removeListener('did-finish-load', onFinish)
      signal.removeEventListener('abort', onAbort)
    }
    target.webContents.once('did-finish-load', onFinish)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function waitForSelector(
  target: BrowserWindow,
  selector: string,
  signal: AbortSignal
): Promise<void> {
  const deadline = Date.now() + 15_000
  await waitForLoad(target, signal)
  while (Date.now() < deadline) {
    signal.throwIfAborted()
    const found = await target.webContents.executeJavaScript(
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      true
    )
    if (found) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`CNKI result list did not appear: ${selector}`)
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
  const timeoutMs = options.timeoutMs ?? 30_000
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  await target.loadURL(url)
  if (options.waitForSelector) await waitForSelector(target, options.waitForSelector, signal)
  else await waitForLoad(target, signal)
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
    await new Promise((resolve) => setTimeout(resolve, 600))
  }
  return true
}

export function disposeCnkiSession(): void {
  if (window && !window.isDestroyed()) window.destroy()
  window = null
}

export const CNKI_SIGN_IN_WINDOW_TIMEOUT_MS = WINDOW_CLOSE_TIMEOUT_MS
