import {
  type DiscoveryCandidate,
  type DiscoveryDocumentType,
  type DiscoveryQuery,
  type DiscoverySourceStatus,
  type DiscoverySourceTier
} from '../../../shared/literature-discovery'
import {
  clickCnkiNextPage,
  evaluateInCnkiWindow,
  evaluateOnCnkiPage,
  getCnkiSignInState,
  loadCnkiPage
} from './cnki-session'
import type { DiscoveryProviderResult } from './openalex-provider'

// CNKI result pages are rendered by the site itself, so every selector below is a best-effort
// snapshot of the current markup. Several fallbacks are tried in order; if none matches, the
// provider reports `parse-failed` together with the page title so the selectors can be retargeted.
const SEARCH_URL = 'https://kns.cnki.net/kns8s/defaultresult/index'
const RESULT_SELECTORS = [
  'table.result-table-list tbody tr',
  '.result-table-list tr',
  '.result-item',
  '.list-item',
  '#gridTable tr'
]
const WAIT_SELECTOR =
  'table.result-table-list, .result-table-list, .result-item, .list-item, #gridTable'
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

const BLOCKED_PATTERN = /login|登录|验证码|安全验证|访问受限|非法请求/u

const EXTRACT_SCRIPT = `(() => {
  const selectors = ${JSON.stringify(RESULT_SELECTORS)}
  let match = null
  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector))
    if (nodes.length) { match = { selector, nodes }; break }
  }
  if (!match) return { selector: null, rows: [] }
  const rows = []
  for (const node of match.nodes) {
    const link = node.querySelector('a')
    const cells = Array.from(node.querySelectorAll('td')).map((cell) => cell.innerText.trim())
    const text = (node.innerText || '').replace(/\\s+/g, ' ').trim()
    const title = (link && link.innerText.trim()) || cells[1] || text.slice(0, 300)
    if (!title || title.length < 2) continue
    rows.push({
      title,
      href: link ? link.href : '',
      authors: cells[2] || '',
      venue: cells[3] || '',
      date: cells[4] || cells[5] || '',
      text
    })
  }
  return { selector: match.selector, rows }
})()`

type ExtractedRow = {
  title: string
  href: string
  authors: string
  venue: string
  date: string
  text: string
}

function buildSearchUrl(query: DiscoveryQuery): string {
  const params = new URLSearchParams()
  params.set('kw', [query.topic, ...query.keywords].join(' ').trim())
  params.set('korder', 'SU')
  if (query.yearFrom !== null || query.yearTo !== null)
    params.set('publishdate', `${query.yearFrom ?? ''},${query.yearTo ?? ''}`)
  return `${SEARCH_URL}?${params.toString()}`
}

function detectDocumentType(text: string): DiscoveryDocumentType {
  for (const [hint, type] of TYPE_HINTS) if (text.includes(hint)) return type
  return 'other'
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

function toCandidate(row: ExtractedRow, index: number): DiscoveryCandidate {
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

export async function searchCnki(
  query: DiscoveryQuery,
  options: { signal?: AbortSignal } = {}
): Promise<DiscoveryProviderResult> {
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

  const signIn = await getCnkiSignInState()
  if (!signIn.signedIn)
    return {
      candidates: [],
      status: status({
        failureCode: 'unauthorized',
        requiresLogin: true,
        // The session message names the cookies that were actually present, which is what makes a
        // mis-detected sign-in diagnosable from the UI.
        message: signIn.message
      })
    }

  const candidates: DiscoveryCandidate[] = []
  const seen = new Set<string>()
  const collect = (rows: readonly ExtractedRow[]): number => {
    let added = 0
    for (const [index, row] of rows.entries()) {
      if (candidates.length >= query.limit) break
      const dedupe = `${row.title}|${parseYear(row.date) ?? ''}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      candidates.push(toCandidate(row, index))
      added += 1
    }
    return added
  }

  try {
    const first = await evaluateOnCnkiPage<{ selector: string | null; rows: ExtractedRow[] }>(
      buildSearchUrl(query),
      EXTRACT_SCRIPT,
      { signal: options.signal, waitForSelector: WAIT_SELECTOR, timeoutMs: 45_000 }
    )
    if (!first.selector) {
      const page = await loadCnkiPage(buildSearchUrl(query), { signal: options.signal })
      const blocked = BLOCKED_PATTERN.test(page.title) || BLOCKED_PATTERN.test(page.url)
      return {
        candidates,
        status: status({
          failureCode: blocked ? 'unauthorized' : 'parse-failed',
          requiresLogin: blocked,
          message: blocked
            ? 'CNKI redirected to a sign-in or verification page.'
            : `CNKI result markup was not recognised (page title: ${page.title || 'untitled'}).`
        })
      }
    }
    collect(first.rows)

    for (let page = 2; page <= MAX_PAGES && candidates.length < query.limit; page += 1) {
      const advanced = await clickCnkiNextPage({ signal: options.signal })
      if (!advanced) break
      const next = await evaluateInCnkiWindow<{ selector: string | null; rows: ExtractedRow[] }>(
        EXTRACT_SCRIPT
      )
      if (!next.rows.length || collect(next.rows) === 0) break
    }
  } catch (error) {
    return {
      candidates,
      status: status({
        failureCode: 'unavailable',
        message: `CNKI search failed: ${error instanceof Error ? error.message : String(error)}`,
        returned: candidates.length
      })
    }
  }

  return {
    candidates,
    status: status({
      ok: true,
      matched: candidates.length,
      returned: candidates.length,
      failureCode: candidates.length ? null : 'no-results',
      message: candidates.length ? '' : 'CNKI returned no records for this query.'
    })
  }
}
