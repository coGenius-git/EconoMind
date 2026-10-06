import { beforeEach, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (
    html: string,
    options: { url: string; runScripts: string }
  ) => {
    window: {
      HTMLElement: typeof HTMLElement
      eval: (script: string) => unknown
      close: () => void
    }
  }
}

const mocks = vi.hoisted(() => ({ launch: vi.fn() }))
vi.mock('playwright', () => ({ chromium: { launchPersistentContext: mocks.launch } }))
vi.mock('../../storage-root', () => ({ resolveDataRoot: () => '/test-data' }))

beforeEach(() => {
  vi.resetModules()
  mocks.launch.mockReset()
})

const fakeContext = (): {
  context: Record<string, ReturnType<typeof vi.fn>>
  page: Record<string, ReturnType<typeof vi.fn>>
} => {
  const page = {
    goto: vi.fn(async () => undefined),
    waitForTimeout: vi.fn(async (): Promise<void> => undefined),
    evaluate: vi.fn(async () => ({
      url: 'https://kns.cnki.net/results',
      title: 'Results',
      text: '我的知网'
    })),
    close: vi.fn(async () => undefined),
    waitForSelector: vi.fn(async () => {
      throw new Error('no rows')
    }),
    url: vi.fn(() => 'https://kns.cnki.net/verify/home'),
    isClosed: vi.fn(() => false),
    title: vi.fn(async () => 'CNKI')
  }
  const context = {
    newPage: vi.fn(async () => page),
    pages: vi.fn(() => [page]),
    once: vi.fn(),
    addInitScript: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    clearCookies: vi.fn(async () => undefined)
  }
  return { context, page }
}

it('serializes status requests so a later request cannot close an active browser', async () => {
  const { context, page } = fakeContext()
  let release!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  page.waitForTimeout.mockImplementationOnce(() => blocked)
  mocks.launch.mockResolvedValue(context)
  const { readCnkiSignInState } = await import('./cnki-browser')
  const first = readCnkiSignInState()
  const second = readCnkiSignInState()
  await vi.waitFor(() => expect(page.waitForTimeout).toHaveBeenCalledOnce())
  expect(mocks.launch).toHaveBeenCalledOnce()
  expect(context.close).not.toHaveBeenCalled()
  release()
  expect((await first).signedIn).toBe(true)
  expect((await second).signedIn).toBe(true)
  expect(mocks.launch).toHaveBeenCalledTimes(2)
  expect(context.close).toHaveBeenCalledTimes(2)
})

it('clears cookies through the same system browser fallback used for sign-in', async () => {
  const { context } = fakeContext()
  mocks.launch.mockResolvedValue(context)
  const { signOutCnki } = await import('./cnki-browser')
  expect((await signOutCnki()).signedIn).toBe(false)
  expect(mocks.launch.mock.calls[0]?.[1]).toMatchObject({ channel: 'msedge', headless: false })
  expect(context.clearCookies).toHaveBeenCalledOnce()
  expect(context.close).toHaveBeenCalledOnce()
})

it('lets the user finish sign-in instead of closing the window after thirty seconds', async () => {
  const { context, page } = fakeContext()
  mocks.launch.mockResolvedValue(context)
  const { openCnkiSignIn } = await import('./cnki-browser')
  vi.useFakeTimers()
  try {
    const pending = openCnkiSignIn()
    await vi.advanceTimersByTimeAsync(35_000)
    expect(context.close).not.toHaveBeenCalled()
    page.isClosed.mockReturnValue(true)
    await vi.advanceTimersByTimeAsync(1_000)
    await pending
    expect(context.close).toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
})

it('keeps the browser open when CNKI requires manual verification', async () => {
  const { context, page } = fakeContext()
  page.evaluate.mockResolvedValue({
    url: 'https://kns.cnki.net/verify/home',
    title: '安全验证',
    text: '请完成安全验证'
  })
  mocks.launch.mockResolvedValue(context)
  const { scrapeCnkiSearch } = await import('./cnki-browser')
  expect(await scrapeCnkiSearch('https://kns.cnki.net/results', 1)).toMatchObject({
    blocked: true,
    selector: null
  })
  expect(context.close).not.toHaveBeenCalled()
})

it('reports browser network error pages as unavailable', async () => {
  const { context, page } = fakeContext()
  page.url.mockReturnValue('chrome-error://chromewebdata/')
  mocks.launch.mockResolvedValue(context)
  const { scrapeCnkiSearch } = await import('./cnki-browser')
  expect(await scrapeCnkiSearch('https://kns.cnki.net/results', 1)).toMatchObject({
    networkError: true,
    blocked: false
  })
  expect(page.waitForSelector).not.toHaveBeenCalled()
  expect(context.close).toHaveBeenCalledOnce()
})

it('extracts the paper title and named cells instead of an earlier unrelated link', async () => {
  const { context, page } = fakeContext()
  const dom = new JSDOM(
    `<table class="result-table-list"><tbody><tr>
    <td class="seq"><a href="/count">1</a></td>
    <td class="name"><a class="fz14" href="/paper?id=1">绿色金融与企业创新</a></td>
    <td class="author"><a>张三</a><a>李四</a></td>
    <td class="source">经济研究</td><td class="date">2024-05-01</td><td class="db">期刊</td>
  </tr></tbody></table>`,
    { url: 'https://kns.cnki.net/results', runScripts: 'outside-only' }
  )
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {
    get: function (this: HTMLElement) {
      return this.textContent ?? ''
    }
  })
  page.waitForSelector.mockResolvedValue(undefined as never)
  page.url.mockReturnValue('https://kns.cnki.net/results')
  page.evaluate.mockImplementation(async (script?: unknown) => dom.window.eval(String(script)))
  mocks.launch.mockResolvedValue(context)
  const { scrapeCnkiSearch } = await import('./cnki-browser')
  const result = await scrapeCnkiSearch('https://kns.cnki.net/results', 1)
  expect(result.rows).toEqual([
    expect.objectContaining({
      title: '绿色金融与企业创新',
      href: 'https://kns.cnki.net/paper?id=1',
      authors: '张三;李四',
      venue: '经济研究',
      date: '2024-05-01'
    })
  ])
  dom.window.close()
})
