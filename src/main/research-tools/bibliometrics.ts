/**
 * Main-process bibliometrics service.
 *
 * Reads the literature catalog in scope (project / collection / whole library),
 * maps entries into the shared `BibliometricItemInput` shape, and runs the
 * deterministic `analyzeBibliometrics` computation. The renderer panel calls
 * the same shared function directly over the existing `literature.search`
 * channel; this service exists for library-level analysis and for the bundled
 * `bibliometrics` skill to reuse when running on the host.
 */

import type { LiteratureCatalog } from '../literature/catalog'
import {
  analyzeBibliometrics,
  toBibliometricItem,
  type BibliometricItemInput,
  type BibliometricsAnalysis,
  type BibliometricsOptions
} from '../../shared/bibliometrics'

const BIBLIOMETRICS_PAGE_LIMIT = 100
const BIBLIOMETRICS_MAX_FETCHED = 1000

export interface BibliometricsScope {
  projectId?: string
  collectionId?: string
}

interface CatalogItemLike {
  id: string
  title: string
  year?: number | null
  venue?: string | null
  authors?: unknown
  typeFields?: Record<string, unknown> | null
}

interface CatalogEntryViewLike {
  item: CatalogItemLike
}

function isItemView(entry: unknown): entry is CatalogEntryViewLike {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'item' in entry &&
    typeof (entry as { item?: unknown }).item === 'object' &&
    (entry as { item?: unknown }).item !== null
  )
}

/**
 * Fetches up to `BIBLIOMETRICS_MAX_FETCHED` active library items in scope and
 * computes the bibliometrics analysis. Returns an empty analysis when the
 * scope has no items.
 */
export async function analyzeLibraryBibliometrics(
  catalog: Pick<LiteratureCatalog, 'search'>,
  scope: BibliometricsScope = {},
  options: BibliometricsOptions = {}
): Promise<BibliometricsAnalysis> {
  const items: CatalogItemLike[] = []
  let offset = 0
  for (;;) {
    const page = await catalog.search({
      scope: 'library',
      projectId: scope.projectId,
      collectionId: scope.collectionId,
      lifecycle: 'active',
      limit: BIBLIOMETRICS_PAGE_LIMIT,
      offset
    })
    for (const entry of page.entries) {
      if (isItemView(entry) && typeof entry.item.title === 'string') {
        items.push(entry.item)
      }
    }
    if (page.nextOffset === undefined || items.length >= BIBLIOMETRICS_MAX_FETCHED) break
    offset = page.nextOffset
  }
  const inputs: BibliometricItemInput[] = items.map((item) => toBibliometricItem(item))
  return analyzeBibliometrics(inputs, options)
}
