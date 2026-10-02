import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { ScreeningTextPage } from '../../shared/literature-screening'
import { joinPdfTextItems } from '../../shared/pdf-text'
import type { LiteratureAttachmentAuthority } from './attachment-authority'

// Uses the same packaged PDF.js runtime and CJK assets as the existing document reader.
// All pages are retained. No document-level character truncation is allowed here.
export async function parseScreeningPdf(
  authority: LiteratureAttachmentAuthority,
  versionId: string,
  signal: AbortSignal
): Promise<ScreeningTextPage[]> {
  const lease = await authority.openContent(versionId)
  try {
    if (lease.size > 50 * 1024 * 1024)
      throw new Error(
        'PDF exceeds the 50 MB local parsing limit. Import prepared Markdown instead.'
      )
    const require = createRequire(import.meta.url)
    const root = dirname(require.resolve('pdfjs-dist/package.json'))
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    signal.throwIfAborted()
    const data = await lease.readRange(0, lease.size)
    await lease.verifyUnchanged()
    const task = pdfjs.getDocument({
      data,
      cMapUrl: `${join(root, 'cmaps')}/`,
      cMapPacked: true,
      standardFontDataUrl: `${join(root, 'standard_fonts')}/`,
      isEvalSupported: false,
      useSystemFonts: false,
      verbosity: 0
    })
    const abort = (): void => {
      void task.destroy()
    }
    signal.addEventListener('abort', abort, { once: true })
    try {
      const pdf = await task.promise
      const pages: ScreeningTextPage[] = []
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        signal.throwIfAborted()
        const page = await pdf.getPage(pageNumber)
        const content = await page.getTextContent()
        const text = joinPdfTextItems(content.items.map((item) => ('str' in item ? item : {})))
        pages.push({ page: pageNumber, text })
        page.cleanup()
      }
      return pages
    } finally {
      signal.removeEventListener('abort', abort)
      await task.destroy()
    }
  } finally {
    await lease.close()
  }
}
