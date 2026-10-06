import { z } from 'zod'
import { setTimeout as delay } from 'node:timers/promises'
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

type OpenAlexOptions = {
  fetch?: typeof fetch
  apiKey?: () => Promise<string | undefined>
  contactEmail?: () => Promise<string | undefined>
  signal?: AbortSignal
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
}

class OpenAlexRateLimitError extends Error {
  constructor(
    readonly reason: 'daily-budget' | 'request-rate',
    readonly retryAt: number
  ) {
    super('OpenAlex rate limit')
  }
}

function secondsHeader(response: Response, name: string): number | undefined {
  const value = response.headers.get(name)
  if (value === null || !value.trim()) return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

async function fetchPage(url: string, options: OpenAlexOptions): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await (options.fetch ?? globalThis.fetch)(url, {
      headers: { accept: 'application/json' },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (response.status !== 429) return response
    const body = await response.text()
    const daily =
      secondsHeader(response, 'x-ratelimit-remaining') === 0 ||
      /insufficient budget|daily.*(?:budget|limit)|budget.*used up/iu.test(body)
    const retry = response.headers.get('retry-after')
    const retrySeconds =
      secondsHeader(response, 'retry-after') ??
      (retry && Number.isFinite(Date.parse(retry))
        ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
        : undefined)
    const reset = secondsHeader(response, 'x-ratelimit-reset')
    const waitMs = daily
      ? (reset ?? retrySeconds ?? 86400 - (Math.floor(Date.now() / 1000) % 86400)) * 1000
      : Math.max(1000, (retrySeconds ?? 2 ** attempt) * 1000)
    if (daily || attempt >= 2 || waitMs > 5000)
      throw new OpenAlexRateLimitError(
        daily ? 'daily-budget' : 'request-rate',
        Math.ceil(Date.now() + waitMs)
      )
    options.signal?.throwIfAborted()
    await (
      options.sleep ??
      (async (milliseconds, signal) => {
        await delay(milliseconds, undefined, { signal })
      })
    )(waitMs, options.signal)
    options.signal?.throwIfAborted()
  }
}

// Cache belongs to one service, is bounded, and is isolated by the configured credential.
export function createOpenAlexSearch(
  options: OpenAlexOptions = {}
): (query: DiscoveryQuery, signal?: AbortSignal) => Promise<DiscoveryProviderResult> {
  const cache = new Map<string, { expires: number; result: DiscoveryProviderResult }>()
  const cooldowns = new Map<string, DiscoverySourceStatus>()
  const pending = new Map<string, Promise<DiscoveryProviderResult>>()
  return async (query, signal) => {
    signal?.throwIfAborted()
    const apiKey = await options.apiKey?.()
    const credential = apiKey ?? ''
    const key = JSON.stringify([credential, query])
    const cached = cache.get(key)
    if (cached && cached.expires > Date.now()) return structuredClone(cached.result)
    for (const [id, value] of cache) if (value.expires <= Date.now()) cache.delete(id)
    const cooldown = cooldowns.get(credential)
    if (cooldown?.retryAt && cooldown.retryAt > Date.now())
      return {
        candidates: [],
        status: {
          ...cooldown,
          matched: 0,
          returned: 0,
          unresolvedTiers: buildFilters(query).unresolved
        }
      }
    const run = async (): Promise<DiscoveryProviderResult> => {
      const result = await searchOpenAlex(query, { ...options, signal, apiKey: async () => apiKey })
      if (result.status.failureCode === 'rate-limited') {
        cooldowns.set(credential, result.status)
        while (cooldowns.size > 8) cooldowns.delete(cooldowns.keys().next().value!)
      }
      if (result.status.ok) {
        cache.set(key, { expires: Date.now() + 5 * 60_000, result: structuredClone(result) })
        while (cache.size > 32) cache.delete(cache.keys().next().value!)
      }
      return result
    }
    // One caller's cancellation must not cancel another caller's shared request.
    if (signal) return run()
    let promise = pending.get(key)
    if (!promise) {
      promise = run().finally(() => pending.delete(key))
      pending.set(key, promise)
    }
    return structuredClone(await promise)
  }
}

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
  options: OpenAlexOptions = {}
): Promise<DiscoveryProviderResult> {
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

  const candidates: DiscoveryCandidate[] = []
  let matched = 0
  try {
    for (let page = 1; page <= MAX_PAGES && candidates.length < query.limit; page += 1) {
      const url = new URL(OPENALEX_API)
      const params = new URLSearchParams({
        search: searchText,
        per_page: String(MAX_PER_PAGE),
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
      url.search = params.toString()

      const response = await fetchPage(url.href, options)
      if (!response.ok) {
        return {
          candidates,
          status: {
            ...empty,
            failureCode: [401, 403].includes(response.status) ? 'unauthorized' : 'unavailable',
            message: `OpenAlex returned HTTP ${response.status}.`,
            returned: candidates.length,
            matched
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
      if (payload.results.length < MAX_PER_PAGE) break
    }
  } catch (error) {
    if (error instanceof OpenAlexRateLimitError)
      return {
        candidates,
        status: {
          ...empty,
          matched,
          returned: candidates.length,
          failureCode: 'rate-limited',
          rateLimitReason: error.reason,
          retryAt: error.retryAt,
          requiresApiKey: !apiKey && error.reason === 'daily-budget',
          message:
            error.reason === 'daily-budget'
              ? 'OpenAlex daily budget is exhausted.'
              : 'OpenAlex is temporarily rate limited.'
        }
      }
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
