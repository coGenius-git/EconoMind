import { createHash } from 'node:crypto'
import {
  type DiscoveryCandidate,
  type DiscoveryDocumentType,
  type DiscoveryQuery,
  type DiscoverySourceStatus
} from '../../../shared/literature-discovery'
import { CNKI_SEARCH_URL, scrapeCnkiSearch } from './cnki-browser'
import type { DiscoveryProviderResult } from './openalex-provider'

const MAX_PAGES = 12

const TYPE_HINTS: ReadonlyArray<readonly [string, DiscoveryDocumentType]> = [
  ['博士', 'dissertation'],
  ['硕士', 'dissertation'],
  ['学位论文', 'dissertation'],
  ['会议', 'conference'],
  ['综述', 'review'],
  ['图书', 'book'],
  ['报纸', 'other'],
  ['期刊', 'article']
]

function buildSearchUrl(query: DiscoveryQuery): string {
  const params = new URLSearchParams()
  params.set('kw', [query.topic, ...query.keywords].join(' ').trim())
  params.set('korder', 'SU')
  if (query.yearFrom !== null || query.yearTo !== null)
    params.set('publishdate', `${query.yearFrom ?? ''},${query.yearTo ?? ''}`)
  return `${CNKI_SEARCH_URL}?${params.toString()}`
}

function detectDocumentType(text: string): DiscoveryDocumentType {
  for (const [hint, type] of TYPE_HINTS) if (text.includes(hint)) return type
  return 'article'
}

function parseYear(value: string): number | null {
  const match = /\d{4}/u.exec(value)
  if (!match) return null
  const year = Number(match[0])
  return year >= 1000 && year <= 9999 ? year : null
}

function toCandidate(
  row: {
    title: string
    href: string
    authors: string
    venue: string
    date: string
    text: string
  },
  index: number
): DiscoveryCandidate {
  return {
    key: `cnki:${createHash('sha256')
      .update(row.href || `${row.title}:${index}`)
      .digest('hex')}`,
    source: 'cnki',
    externalId: row.href.slice(0, 512),
    title: row.title.slice(0, 2000),
    authors: row.authors
      .split(/[;,，；]/u)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.slice(0, 300))
      .slice(0, 100),
    year: parseYear(row.date),
    venue: row.venue.slice(0, 1000),
    documentType: detectDocumentType(row.text),
    doi: '',
    url: row.href.slice(0, 2000),
    abstract: '',
    citationCount: null,
    sourceTiers: [],
    openAccessPdfUrl: null
  }
}

// CNKI is searched inside a standalone Chromium that reuses the profile the user signed in with.
// Criteria that its public search page cannot express (citation counts, journal tiers) are applied
// to the rows afterwards, and the unsupported ones are reported back as unresolved.
export async function searchCnki(query: DiscoveryQuery): Promise<DiscoveryProviderResult> {
  const status = (patch: Partial<DiscoverySourceStatus>): DiscoverySourceStatus => ({
    source: 'cnki',
    ok: false,
    matched: 0,
    returned: 0,
    failureCode: 'unavailable',
    message: '',
    requiresLogin: false,
    unresolvedTiers: [...query.sourceTiers],
    ...patch
  })

  try {
    const scraped = await scrapeCnkiSearch(buildSearchUrl(query), MAX_PAGES)
    if (!scraped.selector)
      return {
        candidates: [],
        status: status({
          failureCode: scraped.blocked
            ? 'unauthorized'
            : scraped.networkError
              ? 'unavailable'
              : 'parse-failed',
          requiresLogin: scraped.blocked,
          message: scraped.detail
        })
      }

    const candidates: DiscoveryCandidate[] = []
    const seen = new Set<string>()
    for (const [index, row] of scraped.rows.entries()) {
      if (candidates.length >= query.limit) break
      const candidate = toCandidate(row, index)
      // The public page's URL filters are not authoritative. Apply verifiable metadata filters
      // before the result limit; do not infer journal rankings or missing citation counts.
      if (query.yearFrom !== null && (candidate.year === null || candidate.year < query.yearFrom))
        continue
      if (query.yearTo !== null && (candidate.year === null || candidate.year > query.yearTo))
        continue
      if (query.documentTypes.length && !query.documentTypes.includes(candidate.documentType))
        continue
      const dedupe = `${row.title}|${parseYear(row.date) ?? ''}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      candidates.push(candidate)
    }

    return {
      candidates,
      status: status({
        ok: true,
        matched: scraped.rows.length,
        returned: candidates.length,
        failureCode: candidates.length ? null : 'no-results',
        message: [
          candidates.length ? '' : `CNKI returned no records. ${scraped.detail}`,
          query.sourceTiers.length
            ? `CNKI cannot verify the selected source tiers (${query.sourceTiers.join(', ')}); those criteria were not applied.`
            : '',
          query.minCitations !== null && query.minCitations > 0
            ? 'CNKI search rows do not provide reliable citation counts; the minimum citations criterion was not applied.'
            : ''
        ]
          .filter(Boolean)
          .join(' ')
      })
    }
  } catch (error) {
    return {
      candidates: [],
      status: status({
        failureCode: 'unavailable',
        message: `CNKI search failed: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }
}
