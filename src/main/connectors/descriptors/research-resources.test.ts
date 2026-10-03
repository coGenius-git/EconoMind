import { describe, it, expect, vi } from 'vitest'
import { ParserEngine } from '../engine'
import { RESEARCH_RESOURCES_TOOLS } from './research-resources'
import type { ToolDescriptor } from '../types'

const tool = (id: string): ToolDescriptor => RESEARCH_RESOURCES_TOOLS.find((t) => t.id === id)!
const jsonRes = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as Response
const engine = (fetchImpl: typeof fetch): ParserEngine => new ParserEngine({ fetchImpl })
// The POST body the engine sent on the Nth fetch call.
const bodyOf = (fetchImpl: ReturnType<typeof vi.fn>, n = 0): Record<string, unknown> =>
  JSON.parse((fetchImpl.mock.calls[n][1] as RequestInit).body as string)

// ------------------------------------------------------------------ Grants.gov

describe('research-resources / search_grants', () => {
  const oppHit = (id: string, number: string): Record<string, unknown> => ({
    id,
    number,
    title: `Opp ${number}`,
    agencyCode: 'HHS-NIH11',
    agency: 'National Institutes of Health',
    oppStatus: 'posted',
    openDate: '01/01/2026',
    closeDate: '',
    docType: 'synopsis',
    cfdaList: ['93.399']
  })
  const facets = {
    oppStatusOptions: [{ value: 'posted', count: 2 }],
    agencies: [{ value: 'HHS-NIH11', count: 2 }],
    eligibilities: [],
    fundingCategories: [],
    fundingInstruments: [],
    dateRangeOptions: []
  }

  it('walks the full result set and passes records through verbatim', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonRes({
        errorcode: 0,
        data: { hitCount: 2, oppHits: [oppHit('1', 'A-1'), oppHit('2', 'A-2')], ...facets }
      })
    )
    const out = (await engine(fetchImpl).call(
      tool('search_grants'),
      { keyword: 'cancer', agencies: ['HHS-NIH11'] },
      {}
    )) as Record<string, unknown>
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.grants.gov/v1/api/search2')
    expect(bodyOf(fetchImpl)).toEqual({
      rows: 1000,
      startRecordNum: 0,
      oppStatuses: 'forecasted|posted',
      sortBy: 'oppNum|asc',
      keyword: 'cancer',
      agencies: 'HHS-NIH11'
    })
    expect(out.hit_count).toBe(2)
    expect(out.n_returned).toBe(2)
    expect(out.truncated).toBe(false)
    expect(out.records).toEqual([oppHit('1', 'A-1'), oppHit('2', 'A-2')])
    expect((out.facets as Record<string, unknown>).dateRangeOptions).toEqual([])
  })

  it('paginates via startRecordNum until hitCount is reached', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonRes({ errorcode: 0, data: { hitCount: 2, oppHits: [oppHit('1', 'A-1')], ...facets } })
      )
      .mockResolvedValueOnce(
        jsonRes({ errorcode: 0, data: { hitCount: 2, oppHits: [oppHit('2', 'A-2')] } })
      )
    const out = (await engine(fetchImpl).call(
      tool('search_grants'),
      { keyword: 'cancer' },
      {}
    )) as Record<string, unknown>
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(bodyOf(fetchImpl, 1).startRecordNum).toBe(1)
    expect(out.n_returned).toBe(2)
    expect(out.hit_count).toBe(2)
  })

  it('caps records at max_records and flags truncated after a complete walk', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonRes({
        errorcode: 0,
        data: {
          hitCount: 3,
          oppHits: [oppHit('1', 'A-1'), oppHit('2', 'A-2'), oppHit('3', 'A-3')],
          ...facets
        }
      })
    )
    const out = (await engine(fetchImpl).call(
      tool('search_grants'),
      { keyword: 'cancer', max_records: 2 },
      {}
    )) as Record<string, unknown>
    expect(out.n_returned).toBe(2)
    expect(out.truncated).toBe(true)
    expect((out.records as unknown[]).length).toBe(2)
  })

  it('count_only posts rows=0 and returns hit count + count facets (no dateRangeOptions)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonRes({ errorcode: 0, data: { hitCount: 114, oppHits: [], ...facets } }))
    const out = (await engine(fetchImpl).call(
      tool('search_grants'),
      { keyword: 'cancer', count_only: true },
      {}
    )) as Record<string, unknown>
    expect(bodyOf(fetchImpl).rows).toBe(0)
    expect(out).toMatchObject({ hit_count: 114, n_returned: 0, truncated: false, records: [] })
    const outFacets = out.facets as Record<string, unknown>
    expect('dateRangeOptions' in outFacets).toBe(false)
    expect('oppStatusOptions' in outFacets).toBe(true)
  })

  it('omits facets when include_facets is false', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonRes({ errorcode: 0, data: { hitCount: 0, oppHits: [], ...facets } }))
    const out = (await engine(fetchImpl).call(
      tool('search_grants'),
      { keyword: 'cancer', include_facets: false },
      {}
    )) as Record<string, unknown>
    expect('facets' in out).toBe(false)
  })

  it('maps aln to cfda and pipe-joins list filters', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonRes({ errorcode: 0, data: { hitCount: 0, oppHits: [], ...facets } }))
    await engine(fetchImpl).call(
      tool('search_grants'),
      {
        aln: '93.866',
        agencies: ['HHS-NIH11', 'HHS-FDA'],
        opportunity_statuses: ['posted', 'closed'],
        eligibilities: ['25']
      },
      {}
    )
    expect(bodyOf(fetchImpl)).toMatchObject({
      cfda: '93.866',
      agencies: 'HHS-NIH11|HHS-FDA',
      oppStatuses: 'posted|closed',
      eligibilities: '25'
    })
  })

  it('rejects a call with no search criterion', async () => {
    const fetchImpl = vi.fn()
    await expect(
      engine(fetchImpl).call(tool('search_grants'), { opportunity_statuses: ['posted'] }, {})
    ).rejects.toThrow(/at least one search criterion/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects an invalid opportunity status', async () => {
    const fetchImpl = vi.fn()
    await expect(
      engine(fetchImpl).call(
        tool('search_grants'),
        { keyword: 'cancer', opportunity_statuses: ['bogus'] },
        {}
      )
    ).rejects.toThrow(/invalid oppStatus/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('raises on a non-zero errorcode envelope', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonRes({ errorcode: 2, msg: 'bad request', data: null }))
    await expect(
      engine(fetchImpl).call(tool('search_grants'), { keyword: 'cancer' }, {})
    ).rejects.toThrow(/errorcode 2/)
  })

  it('raises IncompleteRetrieval when duplicate ids never reconcile with hitCount', async () => {
    const dup = oppHit('1', 'A-1')
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonRes({ errorcode: 0, data: { hitCount: 2, oppHits: [dup], ...facets } })
      )
    await expect(
      engine(fetchImpl).call(tool('search_grants'), { keyword: 'cancer' }, {})
    ).rejects.toThrow(/incomplete grants.gov retrieval/)
    // two full walk attempts before giving up (2 pages each)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })
})

// Retired biomedical tools must not return through the general funding connector.
it.each([
  'search_antibodies',
  'get_antibody',
  'find_antibodies_by_catalog',
  'get_antibody_registry_stats'
])('does not publish removed tool %s', (id) => {
  expect(RESEARCH_RESOURCES_TOOLS.some((descriptor) => descriptor.id === id)).toBe(false)
})
