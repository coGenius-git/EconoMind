import { describe, expect, it } from 'vitest'

import {
  analyzeBibliometrics,
  keywordsFromTitle,
  toBibliometricItem,
  type BibliometricItemInput
} from './bibliometrics'

const ITEMS: BibliometricItemInput[] = [
  {
    id: '1',
    title: 'AI and firm innovation',
    year: 2020,
    keywords: ['artificial intelligence', 'innovation', 'firm performance']
  },
  {
    id: '2',
    title: 'Machine learning in management research',
    year: 2021,
    keywords: ['machine learning', 'innovation', 'firm performance']
  },
  {
    id: '3',
    title: 'Digital transformation and firm performance',
    year: 2022,
    keywords: ['digital transformation', 'firm performance']
  },
  {
    id: '4',
    title: 'AI adoption in Chinese manufacturing',
    year: 2023,
    keywords: ['artificial intelligence', 'manufacturing']
  }
]

describe('keywordsFromTitle', () => {
  it('filters English stopwords', () => {
    const keywords = keywordsFromTitle('The Effect of AI on Firm Innovation')
    expect(keywords).toContain('ai')
    expect(keywords).toContain('firm')
    expect(keywords).toContain('innovation')
    expect(keywords).not.toContain('the')
    expect(keywords).not.toContain('effect')
  })

  it('keeps CJK chunks whole', () => {
    const keywords = keywordsFromTitle('人工智能与企业创新研究')
    expect(keywords.some((token) => /[\u4e00-\u9fff]/.test(token))).toBe(true)
  })
})

describe('toBibliometricItem', () => {
  it('prefers explicit keywords over title extraction', () => {
    const item = toBibliometricItem({
      id: 'a',
      title: 'Anything here',
      year: 2020,
      typeFields: { keywords: 'digital transformation; firm performance' }
    })
    expect(item.keywords).toEqual(['digital transformation', 'firm performance'])
  })

  it('falls back to title tokens when keywords are missing', () => {
    const item = toBibliometricItem({ id: 'b', title: 'AI and firm innovation' })
    expect(item.keywords.length).toBeGreaterThan(0)
    expect(item.year).toBeNull()
  })

  it('accepts keywords as an array', () => {
    const item = toBibliometricItem({
      id: 'c',
      title: 'T',
      typeFields: { keywords: ['a', 'b'] }
    })
    expect(item.keywords).toEqual(['a', 'b'])
  })
})

describe('analyzeBibliometrics', () => {
  it('computes frequencies, network, clusters, hotspots and trends', () => {
    const analysis = analyzeBibliometrics(ITEMS)
    expect(analysis.totalItems).toBe(4)
    expect(analysis.yearRange).toEqual([2020, 2023])
    const top = analysis.keywordFrequencies[0]
    expect(top.keyword).toBe('firm performance')
    expect(top.count).toBe(3)
    expect(analysis.keywordNetwork.length).toBeGreaterThan(0)
    expect(analysis.clusters.length).toBeGreaterThan(0)
    expect(analysis.clusters.every((cluster) => cluster.documentCount > 0)).toBe(true)
    expect(analysis.hotspots.length).toBeGreaterThan(0)
    expect(analysis.trends.length).toBeGreaterThan(0)
  })

  it('returns an empty analysis for empty input', () => {
    const analysis = analyzeBibliometrics([])
    expect(analysis.totalItems).toBe(0)
    expect(analysis.yearRange).toBeNull()
    expect(analysis.keywordNetwork).toEqual([])
    expect(analysis.clusters).toEqual([])
    expect(analysis.hotspots).toEqual([])
    expect(analysis.trends).toEqual([])
  })

  it('skips items without keywords but keeps them in the total', () => {
    const analysis = analyzeBibliometrics([
      { id: 'x', title: 'No keywords here', year: 2021, keywords: [] },
      ...ITEMS
    ])
    expect(analysis.totalItems).toBe(5)
    expect(analysis.keywordFrequencies[0].count).toBe(3)
  })

  it('caps network edges via options', () => {
    const analysis = analyzeBibliometrics(ITEMS, { maxNetworkEdges: 2 })
    expect(analysis.keywordNetwork.length).toBeLessThanOrEqual(2)
  })

  it('computes hotspot growth relative to the latest year', () => {
    const analysis = analyzeBibliometrics(ITEMS)
    const hotspot = analysis.hotspots.find((entry) => entry.keyword === 'artificial intelligence')
    expect(hotspot).toBeDefined()
    expect(hotspot?.totalCount).toBe(2)
    expect(hotspot?.recentCount).toBe(1)
    expect(hotspot?.growth).not.toBeNull()
  })
})
