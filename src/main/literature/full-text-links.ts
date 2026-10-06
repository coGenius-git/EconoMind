import { parse, type DefaultTreeAdapterMap } from 'parse5'
import { fullTextUrl } from './full-text-download'

// Repository records often expose the PDF in citation metadata instead of returning PDF bytes.
// Read explicit document links only; downloadFullText still validates every host and redirect.
export function findPdfLinks(html: Buffer, pageUrl: string): string[] {
  if (html.length > 2 * 1024 * 1024) return []
  const page = fullTextUrl(pageUrl)
  const metadata: string[] = []
  const anchors: string[] = []
  const visit = (node: DefaultTreeAdapterMap['node']): void => {
    if ('tagName' in node) {
      const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]))
      const name = (attributes.get('name') ?? attributes.get('property') ?? '').toLowerCase()
      if (node.tagName === 'meta' && ['citation_pdf_url', 'eprints.document_url'].includes(name))
        metadata.push(attributes.get('content') ?? '')
      if (node.tagName === 'a') {
        const href = attributes.get('href') ?? ''
        if (/\.pdf(?:[?#]|$)/iu.test(href)) anchors.push(href)
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit)
  }
  visit(parse(html.toString('utf8')))
  const links = new Set<string>()
  for (const value of [...metadata, ...anchors]) {
    if (!value.trim()) continue
    try {
      const url = fullTextUrl(new URL(value, page).href)
      if (metadata.includes(value) || url.origin === page.origin) links.add(url.href)
    } catch {
      // Untrusted pages cannot turn a literature download into local-network access.
    }
  }
  return [...links].slice(0, 5)
}
