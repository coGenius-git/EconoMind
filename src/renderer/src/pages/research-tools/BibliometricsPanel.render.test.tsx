// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LiteratureCatalogSearchPage,
  LiteratureCatalogSearchRequest,
  LiteratureItemView
} from '../../../../shared/literature'
import { literatureItemInputSchema } from '../../../../shared/literature'
import { BibliometricsPanel } from './BibliometricsPanel'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const search = vi.fn()

function itemView(id: string, title: string, year: number, keywords: string): LiteratureItemView {
  return {
    id,
    item: literatureItemInputSchema.parse({
      itemType: 'journalArticle',
      title,
      issuedYear: year,
      containerTitle: 'Test Journal',
      identifiers: [],
      creators: [],
      typeFields: { keywords },
      rating: 3
    }),
    metadataRevision: 1,
    createdAt: 1,
    updatedAt: 1,
    attachments: [],
    collectionIds: [],
    projectIds: ['p1']
  }
}

function pageOf(entries: LiteratureItemView[]): LiteratureCatalogSearchPage {
  return { entries, totalCount: entries.length, nextOffset: undefined }
}

beforeEach(() => {
  search.mockReset().mockResolvedValue(pageOf([]))
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      literature: {
        search: async (request: LiteratureCatalogSearchRequest) => {
          const result = await search(request)
          return result as LiteratureCatalogSearchPage
        }
      }
    } as Partial<Window['api']>
  })
})

describe('BibliometricsPanel', () => {
  it('renders the panel title and scope name', () => {
    render(
      <BibliometricsPanel
        open
        onClose={() => undefined}
        projectId="p1"
        scopeName="AI innovation project"
      />
    )
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(screen.getByText('Bibliometrics')).not.toBeNull()
    expect(screen.getByText('AI innovation project')).not.toBeNull()
  })

  it('shows an empty-state message for an empty library', async () => {
    render(
      <BibliometricsPanel
        open
        onClose={() => undefined}
        projectId="p1"
        scopeName="AI innovation project"
      />
    )
    expect(await screen.findByText('The library is empty in this scope')).not.toBeNull()
  })

  it('computes and shows statistics from the catalog', async () => {
    search.mockResolvedValue(
      pageOf([
        itemView('1', 'AI and firm innovation', 2020, 'artificial intelligence, innovation'),
        itemView(
          '2',
          'Machine learning and firm performance',
          2021,
          'machine learning, innovation'
        ),
        itemView('3', 'Digital transformation', 2022, 'digital transformation, firm performance')
      ])
    )
    render(
      <BibliometricsPanel
        open
        onClose={() => undefined}
        projectId="p1"
        scopeName="AI innovation project"
      />
    )
    expect(await screen.findByText('Papers analyzed')).not.toBeNull()
    expect(screen.getByText('3')).not.toBeNull()
    expect(screen.getByText('Topic clusters')).not.toBeNull()
  })

  it('surfaces search failures', async () => {
    search.mockRejectedValue(new Error('database unavailable'))
    render(
      <BibliometricsPanel
        open
        onClose={() => undefined}
        projectId="p1"
        scopeName="AI innovation project"
      />
    )
    expect(await screen.findByText(/database unavailable/)).not.toBeNull()
  })

  it('does not render when closed', () => {
    const { container } = render(
      <BibliometricsPanel
        open={false}
        onClose={() => undefined}
        projectId="p1"
        scopeName="AI innovation project"
      />
    )
    expect(container.textContent ?? '').toBe('')
  })
})
