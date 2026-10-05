import { beforeEach, expect, it, vi } from 'vitest'
import { discoveryQuerySchema } from '../../../shared/literature-discovery'
import type { CnkiScrapeResult } from './cnki-browser'

const mocks = vi.hoisted(() => ({ scrape: vi.fn() }))
vi.mock('./cnki-browser', () => ({
  CNKI_SEARCH_URL: 'https://kns.cnki.net/search',
  readCnkiSignInState: async () => ({ signedIn: true, message: '' }),
  scrapeCnkiSearch: mocks.scrape
}))
import { searchCnki } from './cnki-provider'

const row = (title: string, date: string, text = '期刊'): CnkiScrapeResult['rows'][number] => ({
  title,
  date,
  text,
  href: `https://kns.cnki.net/${title}`,
  authors: '作者',
  venue: '期刊'
})
beforeEach(() => mocks.scrape.mockReset())

it('filters years and document types before applying the result limit', async () => {
  mocks.scrape.mockResolvedValue({
    selector: 'table',
    rows: [row('Old', '2010'), row('Thesis', '2022', '硕士'), row('Included', '2023')],
    detail: '',
    blocked: false
  })
  const result = await searchCnki(
    discoveryQuerySchema.parse({
      topic: 'finance',
      yearFrom: 2020,
      yearTo: 2024,
      documentTypes: ['article'],
      sources: ['cnki'],
      limit: 1
    })
  )
  expect(result.candidates.map((candidate) => candidate.title)).toEqual(['Included'])
})

it('reports journal tiers and citation thresholds that CNKI rows cannot verify', async () => {
  mocks.scrape.mockResolvedValue({
    selector: 'table',
    rows: [row('Included', '2023')],
    detail: '',
    blocked: false
  })
  const result = await searchCnki(
    discoveryQuerySchema.parse({
      topic: 'finance',
      sourceTiers: ['cssci'],
      minCitations: 10,
      sources: ['cnki']
    })
  )
  expect(result.status.unresolvedTiers).toEqual(['cssci'])
  expect(result.status.message).toContain('minimum citations criterion was not applied')
})
