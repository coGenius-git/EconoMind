import { describe, expect, it, vi } from 'vitest'
import type { LiteratureItemInput } from '../../../shared/literature'
import {
  DISCOVERY_SOURCE_TIERS,
  type DiscoveryCandidate,
  type DiscoveryQuery
} from '../../../shared/literature-discovery'
import { LiteratureDiscovery, candidateToItemInput } from './discovery-service'
import { CnkiPdfDownloadError } from './cnki-pdf-download'

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
      fetch: vi.fn(
        async () =>
          new Response(JSON.stringify({ results: [] }), {
            headers: { 'content-type': 'application/json' }
          })
      ),
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

it('acquires a CNKI PDF alongside its imported metadata and preserves the record when access is required', async () => {
  const acquirePdf = vi.fn(async () => {
    throw new CnkiPdfDownloadError('access-required')
  })
  const discovery = new LiteratureDiscovery({
    importItems: async () => ({ itemIds: ['cnki-item'] }),
    get: async () => undefined,
    model: async () => {
      throw new Error('unused')
    },
    acquirePdf
  })
  const selected = candidate({
    key: 'cnki:1',
    source: 'cnki',
    url: 'https://kns.cnki.net/kcms2/article/abstract?id=1'
  })
  const result = await discovery.import({
    collectionId: null,
    duplicatePolicy: 'reuse',
    candidates: [selected]
  })
  expect(acquirePdf).toHaveBeenCalledWith('cnki-item', selected)
  expect(result.importedCount).toBe(1)
  expect(result.fullText).toEqual([
    { key: 'cnki:1', itemId: 'cnki-item', status: 'failed', reason: 'access-required' }
  ])
})

it('keeps candidate-to-item mappings when duplicate imports reuse a library row', async () => {
  const idsByTitle = new Map<string, string>()
  const discovery = new LiteratureDiscovery({
    importItems: async (inputs) => {
      const ids = inputs.map((input) => {
        if (!idsByTitle.has(input.title)) idsByTitle.set(input.title, `item-${idsByTitle.size}`)
        return idsByTitle.get(input.title)!
      })
      // Mirror the real catalog receipt: IDs are unique rather than positional.
      return { itemIds: [...new Set(ids)] }
    },
    get: async () => undefined,
    model: async () => {
      throw new Error('unused')
    }
  })
  const result = await discovery.import({
    collectionId: null,
    duplicatePolicy: 'reuse',
    candidates: [
      candidate({ key: 'first' }),
      candidate({ key: 'duplicate' }),
      candidate({ key: 'last', title: 'A different paper', doi: '10.1000/two' })
    ]
  })
  expect(result.imported).toEqual([
    { key: 'first', itemId: 'item-0' },
    { key: 'duplicate', itemId: 'item-0' },
    { key: 'last', itemId: 'item-1' }
  ])
  expect(result.importedCount).toBe(2)
  expect(result.skipped).toEqual([])
})

it('downloads selected OpenAlex PDFs after saving records and reports failures without losing records', async () => {
  const acquirePdf = vi.fn(async (itemId: string) => {
    if (itemId === 'item-1') throw new Error('PDF unavailable')
    return 'downloaded' as const
  })
  let nextId = 0
  const discovery = new LiteratureDiscovery({
    importItems: async () => ({ itemIds: [`item-${nextId++}`] }),
    get: async () => undefined,
    model: async () => {
      throw new Error('unused')
    },
    acquirePdf
  })
  const result = await discovery.import({
    collectionId: null,
    duplicatePolicy: 'reuse',
    candidates: [
      candidate({ key: 'first', openAccessPdfUrl: 'https://journal.example/first.pdf' }),
      candidate({
        key: 'second',
        doi: '10.1000/two',
        openAccessPdfUrl: 'https://journal.example/second.pdf'
      }),
      candidate({ key: 'cnki', source: 'cnki' })
    ]
  })
  expect(acquirePdf).toHaveBeenCalledTimes(3)
  expect(acquirePdf).toHaveBeenCalledWith('item-0', expect.objectContaining({ key: 'first' }))
  expect(result.importedCount).toBe(3)
  expect(result).toMatchObject({
    fullText: [
      { key: 'first', itemId: 'item-0', status: 'downloaded' },
      { key: 'second', itemId: 'item-1', status: 'failed' },
      { key: 'cnki', itemId: 'item-2', status: 'downloaded' }
    ]
  })
})
