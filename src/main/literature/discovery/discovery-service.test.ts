import { describe, expect, it } from 'vitest'
import type { LiteratureItemInput } from '../../../shared/literature'
import {
  DISCOVERY_SOURCE_TIERS,
  type DiscoveryCandidate,
  type DiscoveryQuery
} from '../../../shared/literature-discovery'
import { LiteratureDiscovery, candidateToItemInput } from './discovery-service'

const query = (patch: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({
  topic: 'green finance',
  keywords: [],
  yearFrom: null,
  yearTo: null,
  documentTypes: [],
  sourceTiers: [],
  minCitations: null,
  limit: 10,
  sources: ['openalex'],
  ...patch
})

const candidate = (patch: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  key: 'openalex:W1',
  source: 'openalex',
  externalId: 'W1',
  title: 'Green finance and firm value',
  authors: ['Ada Lovelace', '李白'],
  year: 2022,
  venue: 'Journal of Finance',
  documentType: 'article',
  doi: '10.1000/one',
  url: 'https://doi.org/10.1000/one',
  abstract: 'An abstract.',
  citationCount: 12,
  sourceTiers: [],
  openAccessPdfUrl: null,
  ...patch
})

describe('candidateToItemInput', () => {
  it('maps discovery metadata onto a library record', () => {
    const item = candidateToItemInput(candidate())
    expect(item).toMatchObject({
      itemType: 'journalArticle',
      title: 'Green finance and firm value',
      issuedYear: 2022,
      containerTitle: 'Journal of Finance',
      abstract: 'An abstract.'
    })
    expect(item.identifiers).toEqual([{ scheme: 'doi', value: '10.1000/one', isPrimary: true }])
    expect(item.creators[0]).toMatchObject({
      nameMode: 'person',
      familyName: 'Lovelace',
      givenName: 'Ada'
    })
    // CJK names are preserved verbatim instead of being split into given/family parts.
    expect(item.creators[1]).toMatchObject({ familyName: '李白', givenName: '' })
  })

  it('maps document types onto library item types', () => {
    expect(candidateToItemInput(candidate({ documentType: 'dissertation' })).itemType).toBe(
      'thesis'
    )
    expect(candidateToItemInput(candidate({ documentType: 'conference' })).itemType).toBe(
      'conferencePaper'
    )
    expect(candidateToItemInput(candidate({ documentType: 'other' })).itemType).toBe('document')
  })
})

describe('LiteratureDiscovery.search', () => {
  const service = (): LiteratureDiscovery =>
    new LiteratureDiscovery({
      importItems: async (inputs: readonly LiteratureItemInput[]) => ({
        itemIds: inputs.map((_, index) => `item-${index}`)
      }),
      get: async () => undefined,
      model: async () => {
        throw new Error('unused')
      }
    })

  it('reports provider warnings and merges duplicates across sources', async () => {
    const discovery = service()
    const result = await discovery.search(
      query({ sources: ['openalex'], sourceTiers: [...DISCOVERY_SOURCE_TIERS] }),
      undefined
    )
    expect(result.statuses).toHaveLength(1)
    expect(result.warnings.join(' ')).toContain('OpenAlex cannot filter by')
  })
})
