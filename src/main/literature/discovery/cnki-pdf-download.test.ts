import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import type { BrowserContext, Download } from 'playwright'
import { expect, it, vi } from 'vitest'
import { cnkiArticleUrl, readCnkiPdf } from './cnki-pdf-download'

const article = 'https://kns.cnki.net/kcms2/article/abstract?id=paper'
function setup(
  bytes = Buffer.from('%PDF-1.7\nexample'),
  downloadedUrl = 'https://download.cnki.net/paper.pdf',
  afterDownloadEvent?: () => void
): {
  page: EventEmitter & { goto: ReturnType<typeof vi.fn>; url: () => string }
  context: BrowserContext
  download: {
    url: () => string
    createReadStream: ReturnType<typeof vi.fn>
    cancel: ReturnType<typeof vi.fn>
  }
} {
  let currentUrl = 'about:blank'
  const download = {
    url: () => downloadedUrl,
    createReadStream: vi.fn(async () => Readable.from([bytes])),
    cancel: vi.fn(async () => undefined)
  }
  const page = Object.assign(new EventEmitter(), {
    isClosed: () => false,
    url: () => currentUrl,
    goto: vi.fn(async (url: string) => {
      currentUrl = url
    }),
    getByText: vi.fn(() => ({
      all: async () => [],
      first: () => ({ isVisible: async () => false })
    })),
    waitForTimeout: vi.fn(async () => undefined),
    locator: () => ({
      first: () => ({
        waitFor: async () => undefined,
        getAttribute: async () => 'https://bar.cnki.net/bar/download/order',
        click: async () => {
          page.emit('download', download as unknown as Download)
          afterDownloadEvent?.()
        }
      })
    })
  })
  const context = Object.assign(new EventEmitter(), { pages: () => [page] })
  return { page, context: context as unknown as BrowserContext, download }
}

it('reads the PDF delivered by the current browser session', async () => {
  const { context, download } = setup()
  expect((await readCnkiPdf(context, article, 1000)).toString()).toBe('%PDF-1.7\nexample')
  expect(download.createReadStream).toHaveBeenCalledOnce()
})

it('opens the artifact stream before a download popup closes', async () => {
  let popupOpen = true
  const { context, download } = setup(undefined, undefined, () => {
    popupOpen = false
  })
  download.createReadStream.mockImplementation(async () => {
    if (!popupOpen) throw new Error('Target page has been closed')
    return Readable.from([Buffer.from('%PDF-1.7\npopup PDF')])
  })
  expect((await readCnkiPdf(context, article, 1000)).toString()).toBe('%PDF-1.7\npopup PDF')
})

it('rejects CAJ and HTML even when the download was called a PDF', async () => {
  for (const bytes of [Buffer.from('CAJ manuscript'), Buffer.from('<html>Sign in</html>')]) {
    const { context } = setup(bytes)
    await expect(readCnkiPdf(context, article, 1000)).rejects.toMatchObject({
      reason: 'pdf-unavailable'
    })
  }
})

it('cancels oversized downloads and rejects files redirected outside CNKI', async () => {
  const large = setup()
  await expect(readCnkiPdf(large.context, article, 5)).rejects.toMatchObject({
    reason: 'download-failed'
  })
  expect(large.download.cancel).toHaveBeenCalledOnce()
  const redirected = setup(undefined, 'https://example.org/paper.pdf')
  await expect(readCnkiPdf(redirected.context, article, 1000)).rejects.toMatchObject({
    reason: 'pdf-unavailable'
  })
  expect(redirected.download.createReadStream).not.toHaveBeenCalled()
})

it('does not navigate away from an unfinished verification window', async () => {
  const { context, page } = setup()
  page.goto.mockImplementation(async () => undefined)
  page.url = () => 'https://kns.cnki.net/verify/home'
  await expect(readCnkiPdf(context, article, 1000)).rejects.toMatchObject({
    reason: 'verification-required'
  })
  expect(page.goto).not.toHaveBeenCalled()
})

it.each([
  'https://cnki.net.evil.example/kcms2/article/abstract',
  'http://kns.cnki.net/kcms2/article/abstract',
  'https://user:password@kns.cnki.net/kcms2/article/abstract',
  'https://127.0.0.1/kcms2/article/abstract',
  'https://kns.cnki.net/ads/paper.pdf'
])('rejects non-article or unsafe input: %s', (url) => {
  expect(() => cnkiArticleUrl(url)).toThrow()
})
