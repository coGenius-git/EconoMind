import { describe, expect, it, vi } from 'vitest'
import { createOpenAlexSearch, searchOpenAlex } from './openalex-provider'
import type { DiscoveryQuery } from '../../../shared/literature-discovery'

const query = (patch: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({
  topic: 'green finance',
  keywords: [],
  yearFrom: null,
  yearTo: null,
  documentTypes: [],
  sourceTiers: [],
  minCitations: null,
  limit: 50,
  sources: ['openalex'],
  ...patch
})

const work = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'https://openalex.org/W1',
  doi: 'https://doi.org/10.1000/one',
  title: 'Green finance and firm value',
  publication_year: 2022,
  type: 'article',
  cited_by_count: 12,
  abstract_inverted_index: { Green: [0], finance: [1], matters: [2] },
  primary_location: { source: { display_name: 'Journal of Finance', is_in_doaj: false } },
  best_oa_location: { is_oa: true, pdf_url: 'https://example.org/paper.pdf' },
  open_access: { is_oa: true, oa_url: 'https://example.org/paper' },
  authorships: [{ author: { display_name: 'Ada Lovelace' } }],
  ...overrides
})

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  })

describe('searchOpenAlex', () => {
  it('retries a transient 429 after the server delay', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(jsonResponse({ results: [work()] }))
    const sleep = vi.fn(async () => undefined)
    const result = await searchOpenAlex(query(), { fetch: fetcher, sleep })
    expect(result.status.ok).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(1000, undefined)
  })

  it('does not retry exhausted daily budgets and respects cooldown across different queries', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Insufficient budget.' }), {
          status: 429,
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '3600' }
        })
    )
    const search = createOpenAlexSearch({ fetch: fetcher })
    const result = await search(query())
    expect(result.status).toMatchObject({ rateLimitReason: 'daily-budget', requiresApiKey: true })
    expect(result.status.retryAt).toBeGreaterThan(Date.now())
    await search(query({ topic: 'another query' }))
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('a newly saved key can retry immediately and successful repeated searches reuse the cache', async () => {
    let key = ''
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'x-ratelimit-remaining': '0' } })
      )
      .mockResolvedValueOnce(jsonResponse({ results: [work()] }))
    const search = createOpenAlexSearch({ fetch: fetcher, apiKey: async () => key || undefined })
    await search(query())
    key = 'private-test-key'
    const result = await search(query())
    expect(result.status.ok).toBe(true)
    result.candidates[0].title = 'caller mutation'
    expect((await search(query())).candidates[0].title).toBe('Green finance and firm value')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('keeps preceding pages when a later page exhausts the budget', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          meta: { count: 500 },
          results: Array.from({ length: 100 }, (_, i) => work({ id: `W${i}` }))
        })
      )
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'x-ratelimit-remaining': '0' } })
      )
    const result = await searchOpenAlex(query({ limit: 200 }), { fetch: fetcher })
    expect(result.candidates).toHaveLength(100)
    expect(result.status).toMatchObject({
      matched: 500,
      returned: 100,
      failureCode: 'rate-limited'
    })
  })
  it('uses cached PDF URLs only with a configured key and keeps the key out of candidates', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        results: [
          work({
            best_oa_location: null,
            open_access: null,
            content_urls: { pdf: 'https://content.openalex.org/works/W1.pdf' }
          })
        ]
      })
    )
    expect((await searchOpenAlex(query(), { fetch: fetcher })).candidates).toEqual([])
    const result = await searchOpenAlex(query(), {
      fetch: fetcher,
      apiKey: async () => 'private-test-key'
    })
    expect(result.candidates[0]?.openAccessPdfUrl).toBe('https://content.openalex.org/works/W1.pdf')
    expect(JSON.stringify(result.candidates)).not.toContain('private-test-key')
  })
  it('prefers actual PDF locations over a landing page and retains alternate PDF sources', async () => {
    const result = await searchOpenAlex(query(), {
      fetch: vi.fn(async () =>
        jsonResponse({
          results: [
            work({
              best_oa_location: {
                is_oa: true,
                pdf_url: null,
                landing_page_url: 'https://repository.example/record'
              },
              open_access: { is_oa: true, oa_url: 'https://repository.example/record' },
              locations: [
                { is_oa: true, pdf_url: 'https://journal.example/paper.pdf' },
                { is_oa: true, pdf_url: 'https://repository.example/paper.pdf' }
              ]
            })
          ]
        })
      )
    })
    expect(result.candidates[0]?.openAccessPdfUrl).toBe('https://journal.example/paper.pdf')
    expect(result.candidates[0]).toMatchObject({
      openAccessPdfUrls: [
        'https://journal.example/paper.pdf',
        'https://repository.example/paper.pdf',
        'https://repository.example/record'
      ]
    })
  })

  it('fetches a 200-record query in pages within the API limit', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const parameters = new URL(String(url)).searchParams
      expect(Number(parameters.get('per_page'))).toBeLessThanOrEqual(100)
      const page = Number(parameters.get('page'))
      return jsonResponse({
        meta: { count: 200 },
        results: Array.from({ length: 100 }, (_, index) =>
          work({
            id: `https://openalex.org/W${page}-${index}`,
            title: `Paper ${page}-${index}`,
            doi: null
          })
        )
      })
    })
    const result = await searchOpenAlex(query({ limit: 200 }), { fetch: fetcher })
    expect(result.candidates).toHaveLength(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('maps works into candidates, restores the abstract and reports the source status', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ meta: { count: 3 }, results: [work()] }))
    const result = await searchOpenAlex(query({ limit: 5 }), { fetch: fetcher as typeof fetch })

    expect(result.status).toMatchObject({ source: 'openalex', ok: true, matched: 3, returned: 1 })
    expect(result.candidates[0]).toMatchObject({
      key: 'openalex:W1',
      source: 'openalex',
      title: 'Green finance and firm value',
      year: 2022,
      doi: '10.1000/one',
      venue: 'Journal of Finance',
      documentType: 'article',
      citationCount: 12,
      authors: ['Ada Lovelace']
    })
    expect(result.candidates[0]?.abstract).toBe('Green finance matters')
  })

  it('translates query criteria into OpenAlex filters', async () => {
    const fetcher = vi.fn<(url: RequestInfo | URL) => Promise<Response>>(async () =>
      jsonResponse({ meta: { count: 0 }, results: [] })
    )
    await searchOpenAlex(
      query({
        yearFrom: 2018,
        yearTo: 2024,
        documentTypes: ['article', 'dissertation'],
        sourceTiers: ['open-access', 'cssci'],
        minCitations: 10
      }),
      { fetch: fetcher as typeof fetch }
    )
    const url = new URL(String(vi.mocked(fetcher).mock.calls[0]?.[0]))
    const filter = url.searchParams.get('filter') ?? ''
    expect(filter).toContain('from_publication_date:2018-01-01')
    expect(filter).toContain('to_publication_date:2024-12-31')
    expect(filter).toContain('cited_by_count:>9')
    expect(filter).toContain('type:article|dissertation')
    expect(filter).toContain('is_oa:true')
    expect(filter).not.toContain('cssci')
  })

  it('reports unsupported journal tiers as unresolved instead of filtering on them', async () => {
    const fetcher = vi.fn<(url: RequestInfo | URL) => Promise<Response>>(async () =>
      jsonResponse({ meta: { count: 0 }, results: [] })
    )
    const result = await searchOpenAlex(query({ sourceTiers: ['cssci', 'sci', 'doaj'] }), {
      fetch: fetcher as typeof fetch
    })
    expect(result.status.unresolvedTiers).toEqual(['cssci', 'sci'])
    expect(
      new URL(String(vi.mocked(fetcher).mock.calls[0]?.[0])).searchParams.get('filter')
    ).toContain('primary_location.source.is_in_doaj:true')
  })

  it('classifies rate limits and unreachable hosts without throwing', async () => {
    const limited = await searchOpenAlex(query(), {
      fetch: vi.fn(async () => new Response('', { status: 429 })) as unknown as typeof fetch
    })
    expect(limited.status).toMatchObject({ ok: false, failureCode: 'rate-limited' })

    const unreachable = await searchOpenAlex(query(), {
      fetch: vi.fn(async () => {
        throw new Error('network down')
      }) as unknown as typeof fetch
    })
    expect(unreachable.status).toMatchObject({ ok: false, failureCode: 'unavailable' })
    expect(unreachable.status.message).toContain('OpenAlex')
  })

  it('keeps only records whose full text is reachable', async () => {
    const results = [
      work({ id: 'https://openalex.org/W1', title: 'With a PDF' }),
      work({
        id: 'https://openalex.org/W2',
        title: 'Without any full text',
        best_oa_location: null,
        open_access: { is_oa: false, oa_url: null }
      }),
      work({
        id: 'https://openalex.org/W3',
        title: 'With an open-access link only',
        best_oa_location: null,
        open_access: { is_oa: true, oa_url: 'https://example.org/landing' }
      })
    ]
    const fetcher = vi.fn(async () => jsonResponse({ meta: { count: 3 }, results }))
    const result = await searchOpenAlex(query({ limit: 10 }), { fetch: fetcher as typeof fetch })

    expect(result.candidates.map((entry) => entry.title)).toEqual([
      'With a PDF',
      'With an open-access link only'
    ])
    expect(result.candidates[0]?.openAccessPdfUrl).toBe('https://example.org/paper.pdf')
  })

  it('stops at the requested limit', async () => {
    const results = Array.from({ length: 3 }, (_, index) =>
      work({ id: `https://openalex.org/W${index}`, doi: null, title: `Paper ${index}` })
    )
    const fetcher = vi.fn(async () => jsonResponse({ meta: { count: 3 }, results }))
    const result = await searchOpenAlex(query({ limit: 2 }), { fetch: fetcher as typeof fetch })
    expect(result.candidates).toHaveLength(2)
  })
})
