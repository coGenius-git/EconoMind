import { describe, expect, it, vi } from 'vitest'
import { parseScreeningPdf } from './screening-pdf-parser'
import type { LiteratureAttachmentAuthority } from './attachment-authority'

function actualPdf(): Uint8Array {
  const stream =
    'BT /F1 12 Tf 20 180 Td (Digital transformation improves corporate financing efficiency.) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 220] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ]
  let text = '%PDF-1.4\n'
  const offsets = [0]
  for (const [i, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(text))
    text += `${i + 1} 0 obj\n${body}\nendobj\n`
  }
  const xref = Buffer.byteLength(text)
  text += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(text))
}
describe('bundled PDF text parser', () => {
  it('extracts text using the installed PDF.js runtime and releases its content lease', async () => {
    const data = actualPdf()
    const close = vi.fn(async () => undefined)
    const verifyUnchanged = vi.fn(async () => undefined)
    const authority = {
      openContent: async () => ({
        size: data.length,
        readRange: async () => data,
        close,
        verifyUnchanged
      })
    } as unknown as LiteratureAttachmentAuthority
    const pages = await parseScreeningPdf(authority, 'test-version', new AbortController().signal)
    expect(pages).toHaveLength(1)
    expect(pages[0].text).toContain('corporate financing efficiency')
    expect(close).toHaveBeenCalledOnce()
    expect(verifyUnchanged).toHaveBeenCalledOnce()
  })
  it('closes the lease if cancelled before parsing', async () => {
    const close = vi.fn(async () => undefined)
    const authority = {
      openContent: async () => ({ size: 1, close })
    } as unknown as LiteratureAttachmentAuthority
    const controller = new AbortController()
    controller.abort()
    await expect(parseScreeningPdf(authority, 'test-version', controller.signal)).rejects.toThrow()
    expect(close).toHaveBeenCalledOnce()
  })
})
