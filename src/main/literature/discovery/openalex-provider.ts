import { z } from 'zod'
import {
  type DiscoveryCandidate,
  type DiscoveryDocumentType,
  type DiscoveryQuery,
  type DiscoverySourceTier,
  type DiscoverySourceStatus
} from '../../../shared/literature-discovery'

const OPENALEX_API = 'https://api.openalex.org/works'
const MAX_PER_PAGE = 100
const REQUEST_TIMEOUT_MS = 30_000
const MAX_PAGES = 10

// OpenAlex exposes openness and DOAJ membership directly. Journal-level rankings (SCI/SSCI,
// CSSCI, Peking University core) are not part of the OpenAlex schema, so a request asking for
// them is reported as unresolved instead of being applied as a filter.
const RESOLVABLE_TIERS: readonly DiscoverySourceTier[] = ['open-access', 'doaj']

const TYPE_FILTER: Readonly<Record<DiscoveryDocumentType, string | undefined>> = {
  article: 'article',
  review: 'review',
  dissertation: 'dissertation',
  conference: 'proceedings-article',
  book: 'book',
  other: undefined
}

const invertedLocation = z
  .object({
    is_oa: z.boolean().optional(),
    pdf_url: z.string().nullish(),
    landing_page_url: z.string().nullish(),
    source: z.object({ display_name: z.string().nullish() }).nullish()
  })
  .nullish()

const openAlexWorkSchema = z.object({
  id: z.string().optional(),
  doi: z.string().nullish(),
  title: z.string().nullish(),
  display_name: z.string().nullish(),
  publication_year: z.number().int().nullish(),
  publication_date: z.string().nullish(),
  type: z.string().nullish(),
  language: z.string().nullish(),
  cited_by_count: z.number().int().nullish(),
  abstract_inverted_index: z.record(z.string(), z.array(z.number().int())).nullish(),
  primary_location: z
    .object({
      source: z
        .object({
          display_name: z.string().nullish(),
          is_in_doaj: z.boolean().nullish(),
          type: z.string().nullish()
        })
        .nullish()
    })
    .nullish(),
  best_oa_location: invertedLocation,
  locations: z.array(invertedLocation).nullish(),
  content_urls: z.object({ pdf: z.string().nullish() }).nullish(),
  open_access: z.object({ is_oa: z.boolean().nullish(), oa_url: z.string().nullish() }).nullish(),
  authorships: z
    .array(z.object({ author: z.object({ display_name: z.string().nullish() }).nullish() }))
    .nullish()
})
const openAlexResponseSchema = z.object({
  meta: z.object({ count: z.number().int().nullish() }).nullish(),
  results: z.array(openAlexWorkSchema).default([])
})

export type DiscoveryProviderResult = {
  candidates: DiscoveryCandidate[]
  status: DiscoverySourceStatus
}

function restoreAbstract(index: Record<string, number[]> | null | undefined): string {
  if (!index) return ''
  const slots: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) slots[position] = word
  }
  return slots.filter(Boolean).join(' ').trim().slice(0, 20_000)
}

function normalizeDoi(value: string | null | undefined): string {
  if (!value) return ''
  return value.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//iu, '')
}

function mapDocumentType(value: string | null | undefined): DiscoveryDocumentType {
  switch (value) {
    case 'article':
      return 'article'
    case 'review':
      return 'review'
    case 'dissertation':
      return 'dissertation'
    case 'proceedings-article':
      return 'conference'
    case 'book':
    case 'monograph':
    case 'edited-book':
      return 'book'
    default:
      return 'other'
  }
}

function buildFilters(query: DiscoveryQuery): {
  filters: string[]
  unresolved: DiscoverySourceTier[]
} {
  const filters: string[] = []
  const unresolved: DiscoverySourceTier[] = []
  if (query.yearFrom !== null) filters.push(`from_publication_date:${query.yearFrom}-01-01`)
  if (query.yearTo !== null) filters.push(`to_publication_date:${query.yearTo}-12-31`)
  if (query.minCitations !== null && query.minCitations > 0)
    filters.push(`cited_by_count:>${query.minCitations - 1}`)
  const types = query.documentTypes
    .map((type) => TYPE_FILTER[type])
    .filter((value): value is string => Boolean(value))
  if (types.length && !query.documentTypes.includes('other'))
    filters.push(`type:${types.join('|')}`)
  for (const tier of query.sourceTiers) {
    if (!RESOLVABLE_TIERS.includes(tier)) {
      unresolved.push(tier)
      continue
    }
    if (tier === 'open-access') filters.push('is_oa:true')
    else if (tier === 'doaj') filters.push('primary_location.source.is_in_doaj:true')
  }
  return { filters, unresolved }
}

function keyOf(work: z.infer<typeof openAlexWorkSchema>, index: number): string {
  const id = work.id?.trim()
  if (id) return `openalex:${id.replace(/^https?:\/\/openalex\.org\//iu, '')}`
  const doi = normalizeDoi(work.doi)
  if (doi) return `openalex:doi:${doi}`
  return `openalex:row:${index}`
}

export async function searchOpenAlex(
  query: DiscoveryQuery,
  options: {
    fetch?: typeof fetch
    apiKey?: () => Promise<string | undefined>
    contactEmail?: () => Promise<string | undefined>
    signal?: AbortSignal
  } = {}
): Promise<DiscoveryProviderResult> {
  const doFetch = options.fetch ?? globalThis.fetch
  const { filters, unresolved } = buildFilters(query)
  const searchText = [query.topic, ...query.keywords]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')
  const unresolvedTiers = [...new Set(unresolved)]
  const empty: DiscoverySourceStatus = {
    source: 'openalex',
    ok: false,
    matched: 0,
    returned: 0,
    failureCode: 'unavailable',
    message: '',
    requiresLogin: false,
    unresolvedTiers
  }

  const apiKey = options.apiKey ? await options.apiKey() : undefined
  const contactEmail = options.contactEmail ? await options.contactEmail() : undefined

  const candidates: DiscoveryCandidate[] = []
  let matched = 0
  try {
    for (let page = 1; page <= MAX_PAGES && candidates.length < query.limit; page += 1) {
      const url = new URL(OPENALEX_API)
      const params = new URLSearchParams({
        search: searchText,
        per_page: String(Math.min(MAX_PER_PAGE, Math.max(25, query.limit))),
        page: String(page),
        select: [
          'id',
          'doi',
          'title',
          'display_name',
          'publication_year',
          'publication_date',
          'type',
          'language',
          'cited_by_count',
          'abstract_inverted_index',
          'primary_location',
          'best_oa_location',
          'locations',
          'content_urls',
          'open_access',
          'authorships'
        ].join(',')
      })
      if (filters.length) params.set('filter', filters.join(','))
      if (apiKey) params.set('api_key', apiKey)
      else if (contactEmail) params.set('mailto', contactEmail)
      url.search = params.toString()

      const response = await doFetch(url.href, {
        headers: { accept: 'application/json' },
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
      if (!response.ok) {
        return {
          candidates,
          status: {
            ...empty,
            failureCode: response.status === 429 ? 'rate-limited' : 'unavailable',
            message: `OpenAlex returned HTTP ${response.status}.`,
            returned: candidates.length
          }
        }
      }
      const payload = openAlexResponseSchema.parse(await response.json())
      matched = payload.meta?.count ?? matched
      if (!payload.results.length) break
      for (const [index, work] of payload.results.entries()) {
        if (candidates.length >= query.limit) break
        const title = (work.title ?? work.display_name ?? '').trim()
        if (!title) continue
        const documentType = mapDocumentType(work.type)
        if (query.documentTypes.length && !query.documentTypes.includes(documentType)) continue
        // Keep records with a full-text location. Availability is checked during import: try PDF
        // locations first, then repository pages with explicit document links.
        const urls = [
          ...new Set(
            [
              work.best_oa_location?.pdf_url,
              ...(work.locations ?? [])
                .filter((location) => location?.is_oa)
                .map((location) => location?.pdf_url),
              ...(apiKey ? [work.content_urls?.pdf] : []),
              work.open_access?.oa_url,
              work.best_oa_location?.landing_page_url
            ]
              .filter((url): url is string => Boolean(url?.trim()))
              .map((url) => url.trim())
          )
        ].slice(0, 10)
        const fullTextUrl = urls[0]
        if (!fullTextUrl) continue
        const isOa = work.open_access?.is_oa === true || work.best_oa_location?.is_oa === true
        const tiers: DiscoverySourceTier[] = []
        if (isOa) tiers.push('open-access')
        if (work.primary_location?.source?.is_in_doaj === true) tiers.push('doaj')
        candidates.push({
          key: keyOf(work, index),
          source: 'openalex',
          externalId: (work.id ?? '').replace(/^https?:\/\/openalex\.org\//iu, ''),
          title,
          authors: (work.authorships ?? [])
            .map((entry) => entry.author?.display_name?.trim() ?? '')
            .filter(Boolean),
          year: work.publication_year ?? null,
          venue: work.primary_location?.source?.display_name?.trim() ?? '',
          documentType,
          doi: normalizeDoi(work.doi),
          url: (work.doi ?? work.id ?? '').trim(),
          abstract: restoreAbstract(work.abstract_inverted_index),
          citationCount: work.cited_by_count ?? null,
          sourceTiers: tiers,
          openAccessPdfUrl: fullTextUrl,
          openAccessPdfUrls: urls
        })
      }
      if (payload.results.length < 25) break
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      candidates,
      status: {
        ...empty,
        failureCode: aborted ? 'unavailable' : 'unavailable',
        message: aborted
          ? 'The OpenAlex request timed out. Check the network connection and retry.'
          : 'OpenAlex is unreachable. Check the network connection and retry.',
        returned: candidates.length,
        matched
      }
    }
  }

  return {
    candidates,
    status: {
      source: 'openalex',
      ok: true,
      matched,
      returned: candidates.length,
      failureCode: candidates.length ? null : 'no-results',
      message: candidates.length ? '' : 'OpenAlex returned no records for this query.',
      requiresLogin: false,
      unresolvedTiers
    }
  }
}
