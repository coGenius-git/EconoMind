import { describe, expect, it, vi } from 'vitest'

import type { LiteratureCatalogSearchPage } from '../../shared/literature'
import { analyzeLibraryBibliometrics } from './bibliometrics'

function page(offset: number, total: number, limit: number): LiteratureCatalogSearchPage {
  const entries = []
  for (let index = offset; index < Math.min(offset + limit, total); index++) {
    entries.push({
      id: `item-${index}`,
      item: {
        id: `item-${index}`,
        title: `AI and firm innovation ${index}`,
        year: 2020 + (index % 4),
        typeFields: {
          keywords:
            index % 2 === 0 ? 'artificial intelligence, innovation' : 'firm performance, innovation'
        }
      }
    })
  }
  return {
    entries: entries as unknown as LiteratureCatalogSearchPage['entries'],
    nextOffset: offset + limit < total ? offset + limit : undefined,
    totalCount: total
  }
}

describe('analyzeLibraryBibliometrics', () => {
  it('fetches all pages and returns a bibliometrics analysis', async () => {
    const search = vi
      .fn()
      .mockImplementation(async (request: { offset: number; limit: number }) =>
        page(request.offset, 5, 2)
      )
    const analysis = await analyzeLibraryBibliometrics({ search: search as never })
    expect(search).toHaveBeenCalledTimes(3)
    expect(analysis.totalItems).toBe(5)
    expect(analysis.yearRange).toEqual([2020, 2023])
    expect(analysis.keywordFrequencies[0].keyword).toBe('innovation')
  })

  it('passes the scope through to the catalog search', async () => {
    const search = vi.fn().mockResolvedValue(page(0, 0, 100))
    await analyzeLibraryBibliometrics(
      { search: search as never },
      {
        projectId: 'p1',
        collectionId: 'c1'
      }
    )
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'library',
        projectId: 'p1',
        collectionId: 'c1',
        lifecycle: 'active'
      })
    )
  })

  it('returns an empty analysis for an empty library', async () => {
    const search = vi.fn().mockResolvedValue(page(0, 0, 100))
    const analysis = await analyzeLibraryBibliometrics({ search: search as never })
    expect(analysis.totalItems).toBe(0)
    expect(analysis.yearRange).toBeNull()
    expect(analysis.clusters).toEqual([])
  })

  it('ignores non-item entries in the page', async () => {
    const search = vi.fn().mockResolvedValue({
      entries: [
        { id: 'c1', revision: 1, name: 'Collection', itemCount: 0, createdAt: 0, updatedAt: 0 },
        ...page(0, 1, 100).entries
      ],
      nextOffset: undefined,
      totalCount: 1
    })
    const analysis = await analyzeLibraryBibliometrics({ search: search as never })
    expect(analysis.totalItems).toBe(1)
  })
})
