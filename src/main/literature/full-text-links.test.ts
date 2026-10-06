import { expect, it } from 'vitest'
import { findPdfLinks } from './full-text-links'

it('reads citation PDF metadata and same-origin PDF links without trusting private or unrelated links', () => {
  const html =
    Buffer.from(`<meta name="citation_pdf_url" content="https://repository.example/paper.pdf">
    <meta name="citation_pdf_url" content="http://127.0.0.1/private.pdf">
    <a href="/files/paper.pdf?download=1">PDF</a>
    <a href="https://unrelated.example/other.pdf">References</a>
    <a href="https://localhost.local/private.pdf">PDF</a>`)
  expect(findPdfLinks(html, 'https://journal.example/record')).toEqual([
    'https://repository.example/paper.pdf',
    'https://journal.example/files/paper.pdf?download=1'
  ])
})

it('does not parse oversized pages or treat login HTML as PDF content', () => {
  expect(findPdfLinks(Buffer.alloc(2 * 1024 * 1024 + 1), 'https://journal.example/record')).toEqual(
    []
  )
  expect(
    findPdfLinks(
      Buffer.from('<html>Sign in to view this document.</html>'),
      'https://journal.example/record'
    )
  ).toEqual([])
})
