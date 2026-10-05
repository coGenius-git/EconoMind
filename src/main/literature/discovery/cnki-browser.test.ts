import { beforeEach, expect, it, vi } from 'vitest'

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
    title: vi.fn(async () => 'CNKI')
  }
  const context = {
    newPage: vi.fn(async () => page),
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

it('reports a verification redirect as blocked, not a markup parse error', async () => {
  const { context } = fakeContext()
  mocks.launch.mockResolvedValue(context)
  const { scrapeCnkiSearch } = await import('./cnki-browser')
  expect(await scrapeCnkiSearch('https://kns.cnki.net/results', 1)).toMatchObject({
    blocked: true,
    selector: null
  })
  expect(context.close).toHaveBeenCalledOnce()
})
