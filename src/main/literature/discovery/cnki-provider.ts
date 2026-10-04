import {
  type DiscoveryCandidate,
  type DiscoveryDocumentType,
  type DiscoveryQuery,
  type DiscoverySourceStatus,
  type DiscoverySourceTier
} from '../../../shared/literature-discovery'
import { CNKI_SEARCH_URL, readCnkiSignInState, scrapeCnkiSearch } from './cnki-browser'
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

const TIER_HINTS: ReadonlyArray<readonly [string, DiscoverySourceTier]> = [
  ['cssci', 'cssci'],
  ['中文社会科学引文', 'cssci'],
  ['北大核心', 'pkucore'],
  ['核心期刊', 'pkucore'],
  ['ssci', 'ssci'],
  ['sci', 'sci'],
  ['ei', 'ei']
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

function detectTiers(text: string): DiscoverySourceTier[] {
  const lower = text.toLowerCase()
  return TIER_HINTS.filter(([hint]) => lower.includes(hint)).map(([, tier]) => tier)
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
    key: `cnki:${row.href || `${row.title}:${index}`}`,
    source: 'cnki',
    externalId: row.href,
    title: row.title.slice(0, 2000),
    authors: row.authors
      .split(/[;,，；]/u)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 100),
    year: parseYear(row.date),
    venue: row.venue.slice(0, 1000),
    documentType: detectDocumentType(row.text),
    doi: '',
    url: row.href,
    abstract: '',
    citationCount: null,
    sourceTiers: detectTiers(row.text),
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
    unresolvedTiers: [],
    ...patch
  })

  const state = await readCnkiSignInState()
  if (!state.signedIn)
    return {
      candidates: [],
      status: status({
        failureCode: 'unauthorized',
        requiresLogin: true,
        message: state.message
      })
    }

  try {
    const scraped = await scrapeCnkiSearch(buildSearchUrl(query), MAX_PAGES)
    if (!scraped.selector)
      return {
        candidates: [],
        status: status({
          failureCode: scraped.blocked ? 'unauthorized' : 'parse-failed',
          requiresLogin: scraped.blocked,
          message: scraped.blocked
            ? `CNKI redirected to a sign-in or verification page. ${scraped.detail}`
            : `CNKI result markup was not recognised. ${scraped.detail}`
        })
      }

    const candidates: DiscoveryCandidate[] = []
    const seen = new Set<string>()
    for (const [index, row] of scraped.rows.entries()) {
      if (candidates.length >= query.limit) break
      const dedupe = `${row.title}|${parseYear(row.date) ?? ''}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      candidates.push(toCandidate(row, index))
    }

    return {
      candidates,
      status: status({
        ok: true,
        matched: scraped.rows.length,
        returned: candidates.length,
        failureCode: candidates.length ? null : 'no-results',
        message: candidates.length ? '' : `CNKI returned no records. ${scraped.detail}`
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
