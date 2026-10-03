import type { ToolContext, ToolDescriptor } from '../types'

// Read-only Grants.gov funding-opportunity searches.

// ------------------------------------------------------------------ Grants.gov

const GRANTS_URL = 'https://api.grants.gov/v1/api/search2'
// search2 has no documented page-size limit; the upstream client walks 1000 rows per POST.
const GRANTS_ROWS_PER_PAGE = 1000
// Valid oppStatuses; an invalid value is silently accepted upstream and yields empty pages.
const VALID_STATUSES = ['forecasted', 'posted', 'closed', 'archived']
// The API's own default status set when oppStatuses is omitted (current opportunities).
const DEFAULT_STATUSES = 'forecasted|posted'
// Facet blocks returned by search2 (each ignores the filter on its own dimension); the count route
// omits dateRangeOptions.
const SEARCH_FACET_KEYS = [
  'oppStatusOptions',
  'agencies',
  'eligibilities',
  'fundingCategories',
  'fundingInstruments',
  'dateRangeOptions'
]
const COUNT_FACET_KEYS = SEARCH_FACET_KEYS.filter((k) => k !== 'dateRangeOptions')

type OppHit = { id?: string; number?: string } & Record<string, unknown>
type Search2Data = { hitCount: number; oppHits: OppHit[] } & Record<string, unknown>
type Search2Envelope = { errorcode?: number; msg?: string; data?: Search2Data }

// Accepts a string, an array of values, or null/undefined; returns the pipe-joined string ("" empty).
const pipeJoin = (value: unknown): string => {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map((v) => String(v)).join('|')
  return String(value)
}

// Builds one search2 POST body from the tool args (mirrors GrantsSearchSpec.to_payload).
const grantsPayload = (
  a: Record<string, unknown>,
  statuses: string,
  rows: number,
  start: number
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    rows,
    startRecordNum: start,
    oppStatuses: statuses,
    sortBy: 'oppNum|asc'
  }
  if (a.keyword) body.keyword = String(a.keyword)
  if (a.opportunity_number) body.oppNum = String(a.opportunity_number)
  if (a.aln) body.cfda = String(a.aln)
  const agencies = pipeJoin(a.agencies)
  if (agencies) body.agencies = agencies
  const eligibilities = pipeJoin(a.eligibilities)
  if (eligibilities) body.eligibilities = eligibilities
  const fundingCategories = pipeJoin(a.funding_categories)
  if (fundingCategories) body.fundingCategories = fundingCategories
  const fundingInstruments = pipeJoin(a.funding_instruments)
  if (fundingInstruments) body.fundingInstruments = fundingInstruments
  return body
}

// One throttled POST to search2; unwraps the envelope and raises on a non-zero errorcode.
const postSearch2 = async (
  ctx: ToolContext,
  body: Record<string, unknown>
): Promise<Search2Data> => {
  const env = (await ctx.postJson(GRANTS_URL, body)) as Search2Envelope
  if (env.errorcode !== 0) {
    throw new Error(`grants.gov errorcode ${env.errorcode}: ${env.msg ?? ''}`)
  }
  if (!env.data) throw new Error('grants.gov response missing data envelope')
  return env.data
}

// Pulls the requested facet blocks out of a search2 data payload.
const pickFacets = (data: Search2Data, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((k) => [k, data[k]]))

// Full retrieval: walk startRecordNum until every hit is fetched, then verify completeness
// (len == hitCount, ids unique). One automatic re-walk on mismatch (the live corpus can move
// mid-walk); a persistent mismatch raises, mirroring IncompleteRetrievalError.
const walkGrants = async (
  ctx: ToolContext,
  a: Record<string, unknown>,
  statuses: string
): Promise<{ records: OppHit[]; hitCount: number; facets: Record<string, unknown> }> => {
  let records: OppHit[] = []
  let ids: string[] = []
  let hitCount = 0
  for (let attempt = 1; attempt <= 2; attempt++) {
    records = []
    let facets: Record<string, unknown> = {}
    let start = 0
    hitCount = 0
    let first = true
    for (;;) {
      const data = await postSearch2(ctx, grantsPayload(a, statuses, GRANTS_ROWS_PER_PAGE, start))
      if (first) {
        hitCount = data.hitCount
        facets = pickFacets(data, SEARCH_FACET_KEYS)
        first = false
      }
      const hits = data.oppHits ?? []
      records.push(...hits)
      start += hits.length
      if (start >= data.hitCount || hits.length === 0) break
    }
    ids = records.map((r) => String(r.id))
    if (records.length === hitCount && new Set(ids).size === records.length) {
      return { records, hitCount, facets }
    }
  }
  throw new Error(
    `incomplete grants.gov retrieval: ${records.length} records (${new Set(ids).size} unique ids) ` +
      `vs hitCount ${hitCount} after retry — check sortBy validity / corpus motion`
  )
}

export const RESEARCH_RESOURCES_TOOLS: ToolDescriptor[] = [
  {
    id: 'search_grants',
    connector: 'research-resources',
    description:
      'Search Grants.gov funding opportunities via the search2 API (complete, count-verified retrieval). At least one criterion is required (keyword, opportunity_number, aln/CFDA, agencies, eligibilities, funding_categories, or funding_instruments). opportunity_statuses defaults to ["forecasted","posted"] (current opportunities); add "closed"/"archived" for historical ones. agencies takes codes like ["HHS-NIH11"] (NIH), ["HHS-FDA"], ["NSF"]. Set count_only for just the hit count + facets; max_records caps returned records (the walk still retrieves the complete set and flags truncated).',
    input: {
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        opportunity_number: { type: 'string' },
        aln: { type: 'string' },
        agencies: { type: 'array', items: { type: 'string' } },
        opportunity_statuses: {
          type: 'array',
          items: { type: 'string', enum: ['forecasted', 'posted', 'closed', 'archived'] }
        },
        eligibilities: { type: 'array', items: { type: 'string' } },
        funding_categories: { type: 'array', items: { type: 'string' } },
        funding_instruments: { type: 'array', items: { type: 'string' } },
        count_only: { type: 'boolean', default: false },
        max_records: { type: 'integer', default: 100 },
        include_facets: { type: 'boolean', default: true }
      }
    },
    returns:
      '`{ hit_count, n_returned, truncated, records: [ { id, number, title, agencyCode, agency, oppStatus, openDate, closeDate, docType, cfdaList } ], facets? }` — records are the raw search2 hits (verbatim, sorted by oppNum). `truncated` is true when `hit_count` exceeds the returned count. `facets` (when include_facets) holds oppStatusOptions/agencies/eligibilities/fundingCategories/fundingInstruments/dateRangeOptions value counts. With `count_only`, records is [] and n_returned 0.',
    example:
      'const result = await host.mcp("research-resources", "search_grants", {"keyword": "cancer", "agencies": ["HHS-NIH11"], "max_records": 25})',
    run: async (ctx, a) => {
      const statuses = pipeJoin(a.opportunity_statuses) || DEFAULT_STATUSES
      for (const s of statuses.split('|')) {
        if (!VALID_STATUSES.includes(s)) {
          throw new Error(`invalid oppStatus '${s}'; valid: ${VALID_STATUSES.join(', ')}`)
        }
      }
      // At least one search criterion (statuses alone is not a criterion).
      const hasCriterion =
        Boolean(a.keyword) ||
        Boolean(a.opportunity_number) ||
        Boolean(a.aln) ||
        Boolean(pipeJoin(a.agencies)) ||
        Boolean(pipeJoin(a.eligibilities)) ||
        Boolean(pipeJoin(a.funding_categories)) ||
        Boolean(pipeJoin(a.funding_instruments))
      if (!hasCriterion) throw new Error('search_grants needs at least one search criterion')
      const includeFacets = a.include_facets !== false

      if (a.count_only === true) {
        const data = await postSearch2(ctx, grantsPayload(a, statuses, 0, 0))
        const out: Record<string, unknown> = {
          hit_count: data.hitCount,
          n_returned: 0,
          truncated: false,
          records: []
        }
        if (includeFacets) out.facets = pickFacets(data, COUNT_FACET_KEYS)
        return out
      }

      const { records, hitCount, facets } = await walkGrants(ctx, a, statuses)
      const maxRecords = Math.max(0, Number(a.max_records ?? 100))
      const kept = records.slice(0, maxRecords)
      const out: Record<string, unknown> = {
        hit_count: hitCount,
        n_returned: kept.length,
        truncated: hitCount > kept.length,
        records: kept
      }
      if (includeFacets) out.facets = facets
      return out
    }
  }
]
