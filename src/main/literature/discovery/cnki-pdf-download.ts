import type { BrowserContext, Download, Page } from 'playwright'
import type { LiteratureFullTextProgress } from '../../../shared/literature'

export type CnkiPdfFailureReason =
  'access-required' | 'verification-required' | 'pdf-unavailable' | 'download-failed'
export class CnkiPdfDownloadError extends Error {
  constructor(readonly reason: CnkiPdfFailureReason) {
    super(`CNKI PDF: ${reason}`)
  }
}

const LOGIN = /\/(?:login|passport|sso|signin)(?:\/|$)/iu
const VERIFICATION = /\/(?:verify|captcha|checkcode)(?:\/|$)/iu
const PDF_CONTROL =
  '#pdfDown:visible, a[name="pdfDown"]:visible, .btn-dlpdf > a:visible, ' +
  '#DownLoadParts a:has-text("PDF"):visible, ' +
  'a:has-text("PDF下载"):visible, a:has-text("PDF 下载"):visible'

function cnkiUrl(raw: string): URL {
  const url = new URL(raw)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !/(?:^|\.)cnki\.net$/iu.test(url.hostname) ||
    (url.port && url.port !== '443')
  )
    throw new CnkiPdfDownloadError('pdf-unavailable')
  return url
}

export function cnkiArticleUrl(raw: string): URL {
  const url = cnkiUrl(raw)
  if (!/^\/kcms2?\/(?:article\/(?:abstract|detail)|detail\/detail\.aspx)/iu.test(url.pathname))
    throw new CnkiPdfDownloadError('pdf-unavailable')
  return url
}

async function readDownload(
  download: Download,
  maxBytes: number,
  onProgress?: (progress: LiteratureFullTextProgress) => void
): Promise<Buffer> {
  cnkiUrl(download.url())
  const stream = await download.createReadStream()
  if (!stream) throw new CnkiPdfDownloadError('download-failed')
  const chunks: Buffer[] = []
  let receivedBytes = 0
  const started = Date.now()
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk)
    receivedBytes += bytes.length
    if (receivedBytes > maxBytes) {
      stream.destroy()
      await download.cancel().catch(() => undefined)
      throw new CnkiPdfDownloadError('download-failed')
    }
    chunks.push(bytes)
    onProgress?.({
      receivedBytes,
      bytesPerSecond: Math.floor((receivedBytes * 1000) / Math.max(1, Date.now() - started)),
      phase: 'downloading'
    })
  }
  const bytes = Buffer.concat(chunks)
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-')
    throw new CnkiPdfDownloadError('pdf-unavailable')
  return bytes
}

async function blocker(page: Page): Promise<CnkiPdfFailureReason | undefined> {
  if (page.isClosed()) return undefined
  const url = page.url()
  if (VERIFICATION.test(url)) return 'verification-required'
  // These widgets can exist in hidden HTML on ordinary article pages; only visible challenges count.
  for (const challenge of await page.getByText('拖动下方拼图完成验证').all())
    if (await challenge.isVisible()) return 'verification-required'
  if (LOGIN.test(url)) return 'access-required'
  return undefined
}

// Click the official PDF control in the existing profile. No cookies, passwords or signed URLs
// leave the browser session. A login/security page stays visible for the user to complete.
export async function readCnkiPdf(
  context: BrowserContext,
  rawUrl: string,
  maxBytes: number,
  onProgress?: (progress: LiteratureFullTextProgress) => void
): Promise<Buffer> {
  const url = cnkiArticleUrl(rawUrl)
  for (const existing of context.pages()) {
    const reason = await blocker(existing)
    if (reason) throw new CnkiPdfDownloadError(reason)
  }
  const page = context.pages()[0] ?? (await context.newPage())
  let download: Download | undefined
  let document: Promise<{ bytes: Buffer } | { error: unknown }> | undefined
  const watched = new Set<Page>()
  const capture = (value: Download): void => {
    if (download) return
    download = value
    // Download popups can close immediately. Start reading at the event, before waiting for
    // the login page to navigate, so the browser artifact remains available.
    document = readDownload(value, maxBytes, onProgress).then(
      (bytes) => ({ bytes }),
      (error) => ({ error })
    )
  }
  const watch = (target: Page): void => {
    watched.add(target)
    target.on('download', capture)
  }
  context.pages().forEach(watch)
  context.on('page', watch)
  try {
    await page
      .goto(url.href, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      .catch(() => undefined)
    const initialBlocker = await blocker(page)
    if (initialBlocker) throw new CnkiPdfDownloadError(initialBlocker)
    cnkiUrl(page.url())
    const button = page.locator(PDF_CONTROL).first()
    try {
      await button.waitFor({ state: 'visible', timeout: 10_000 })
    } catch {
      throw new CnkiPdfDownloadError((await blocker(page)) ?? 'pdf-unavailable')
    }
    const href = await button.getAttribute('href')
    if (href && !/^javascript:/iu.test(href)) cnkiUrl(new URL(href, page.url()).href)
    await button.click({ timeout: 10_000, noWaitAfter: true })
    const deadline = Date.now() + 45_000
    const ipAttempted = new Set<Page>()
    while (!download && Date.now() < deadline) {
      for (const target of context.pages()) {
        const reason = await blocker(target)
        if (reason === 'access-required' && !ipAttempted.has(target)) {
          ipAttempted.add(target)
          cnkiUrl(target.url())
          const ipLogin = target.getByText(/^IP\s*登\s*录$/u).first()
          if (await ipLogin.isVisible()) {
            await ipLogin.click({ timeout: 5000, noWaitAfter: true })
            await target
              .waitForURL((value) => !LOGIN.test(value.href), { timeout: 5000 })
              .catch(() => undefined)
            if (download) break
            continue
          }
        }
        if (reason) throw new CnkiPdfDownloadError(reason)
      }
      if (!download) await page.waitForTimeout(250)
    }
    if (!document) throw new CnkiPdfDownloadError('download-failed')
    const result = await document
    if ('error' in result) throw result.error
    return result.bytes
  } catch (error) {
    if (error instanceof CnkiPdfDownloadError) throw error
    throw new CnkiPdfDownloadError('download-failed')
  } finally {
    context.off('page', watch)
    for (const target of watched) target.off('download', capture)
  }
}
