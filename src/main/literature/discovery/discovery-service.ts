import type { LiteratureItemInput, LiteratureItemView } from '../../../shared/literature'
import {
  type DiscoveryCandidate,
  type DiscoveryDocumentType,
  type DiscoveryImportRequest,
  type DiscoveryImportResult,
  type DiscoveryQuery,
  type DiscoveryScreenRequest,
  type DiscoveryScreenResult,
  type DiscoverySearchResponse,
  type DiscoverySourceId
} from '../../../shared/literature-discovery'
import { searchCnki } from './cnki-provider'
import { searchOpenAlex, type DiscoveryProviderResult } from './openalex-provider'
import { screenRecords, type RecordScreeningModel } from './record-screening'

const ITEM_TYPE_BY_DOCUMENT_TYPE: Readonly<
  Record<DiscoveryDocumentType, LiteratureItemInput['itemType']>
> = {
  article: 'journalArticle',
  review: 'review',
  dissertation: 'thesis',
  conference: 'conferencePaper',
  book: 'book',
  other: 'document'
}

function normalizeForDedupe(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

function dedupeKey(candidate: DiscoveryCandidate): string {
  const title = normalizeForDedupe(candidate.title)
  const year = candidate.year ?? ''
  const doi = candidate.doi ? normalizeForDedupe(candidate.doi) : ''
  return doi ? `doi:${doi}` : `title:${title}:${year}`
}

function splitName(value: string): { givenName: string; familyName: string } {
  const trimmed = value.trim()
  // CJK names carry no reliable given/family split; keep them in familyName so the name renders
  // unchanged, and split only the unambiguous "Family, Given" western form.
  const comma = trimmed.split(',')
  if (comma.length === 2 && comma[0].trim() && comma[1].trim())
    return { familyName: comma[0].trim(), givenName: comma[1].trim() }
  if (/[一-鿿]/u.test(trimmed)) return { familyName: trimmed, givenName: '' }
  const parts = trimmed.split(/\s+/u)
  if (parts.length === 1) return { familyName: trimmed, givenName: '' }
  return { familyName: parts[parts.length - 1], givenName: parts.slice(0, -1).join(' ') }
}

export function candidateToItemInput(candidate: DiscoveryCandidate): LiteratureItemInput {
  const identifiers: LiteratureItemInput['identifiers'] = []
  if (candidate.doi) identifiers.push({ scheme: 'doi', value: candidate.doi, isPrimary: true })
  if (candidate.externalId && candidate.source === 'cnki')
    identifiers.push({ scheme: 'other', value: candidate.externalId, isPrimary: !candidate.doi })

  return {
    itemType: ITEM_TYPE_BY_DOCUMENT_TYPE[candidate.documentType],
    title: candidate.title,
    abstract: candidate.abstract,
    issuedText: candidate.year === null ? '' : String(candidate.year),
    ...(candidate.year === null ? {} : { issuedYear: candidate.year }),
    containerTitle: candidate.venue,
    language: '',
    rights: '',
    url: candidate.url || candidate.openAccessPdfUrl || '',
    citationKey: undefined,
    extra: JSON.stringify({
      discoverySource: candidate.source,
      discoveryKey: candidate.key,
      ...(candidate.citationCount === null ? {} : { citationCount: candidate.citationCount }),
      ...(candidate.sourceTiers.length ? { sourceTiers: candidate.sourceTiers } : {})
    }),
    typeFields: {},
    creators: candidate.authors.slice(0, 100).map((name) => {
      const { givenName, familyName } = splitName(name)
      return { nameMode: 'person' as const, givenName, familyName, creatorType: 'author' }
    }),
    identifiers
  }
}

export type LiteratureDiscoveryOptions = {
  importItems(
    inputs: readonly LiteratureItemInput[],
    collectionId: string | null | undefined,
    duplicatePolicy: 'reuse' | 'separate'
  ): Promise<{ itemIds: string[] }>
  get(itemId: string): Promise<LiteratureItemView | undefined>
  model(): Promise<RecordScreeningModel>
  openAlexKey?: () => Promise<string | undefined>
  contactEmail?: () => Promise<string | undefined>
  fetch?: typeof fetch
}

export class LiteratureDiscovery {
  constructor(private readonly options: LiteratureDiscoveryOptions) {}

  async search(query: DiscoveryQuery, signal?: AbortSignal): Promise<DiscoverySearchResponse> {
    const requested = query.sources
    const settled = await Promise.all(
      requested.map(async (source): Promise<DiscoveryProviderResult> => {
        if (source === 'openalex')
          return searchOpenAlex(query, {
            signal,
            fetch: this.options.fetch,
            apiKey: this.options.openAlexKey,
            contactEmail: this.options.contactEmail
          })
        return searchCnki(query, { signal })
      })
    )

    const warnings: string[] = []
    const candidates: DiscoveryCandidate[] = []
    const seen = new Set<string>()
    let duplicatesRemoved = 0
    for (const result of settled) {
      if (result.status.unresolvedTiers.length)
        warnings.push(
          `OpenAlex cannot filter by ${result.status.unresolvedTiers.join(', ')}; those criteria were applied to CNKI only.`
        )
      if (result.status.failureCode && result.status.message) warnings.push(result.status.message)
      for (const candidate of result.candidates) {
        if (candidates.length >= query.limit) break
        const key = dedupeKey(candidate)
        if (seen.has(key)) {
          duplicatesRemoved += 1
          continue
        }
        seen.add(key)
        candidates.push(candidate)
      }
    }
    if (duplicatesRemoved > 0)
      warnings.push(`${duplicatesRemoved} duplicate record(s) across sources were merged.`)
    if (candidates.some((candidate) => candidate.source === 'cnki' && !candidate.abstract))
      warnings.push(
        'CNKI records do not include abstracts; screening uses titles and metadata only.'
      )

    return {
      candidates,
      statuses: settled.map((result) => result.status),
      warnings: [...new Set(warnings)].slice(0, 20)
    }
  }

  async import(request: DiscoveryImportRequest): Promise<DiscoveryImportResult> {
    const inputs = request.candidates.map(candidateToItemInput)
    const receipt = await this.options.importItems(
      inputs,
      request.collectionId,
      request.duplicatePolicy
    )
    // importItems returns ids positionally: reused records keep their original id and no new row.
    const imported = receipt.itemIds.map((itemId, index) => ({
      key: request.candidates[index]?.key ?? `index:${index}`,
      itemId
    }))
    const matchedKeys = new Set(imported.map((entry) => entry.key))
    const skipped = request.candidates
      .filter((candidate) => !matchedKeys.has(candidate.key))
      .map((candidate) => ({
        key: candidate.key,
        reason: 'Merged into an existing library record.'
      }))
    return {
      imported,
      skipped,
      importedCount: imported.length
    }
  }

  async screen(
    request: DiscoveryScreenRequest,
    signal?: AbortSignal
  ): Promise<DiscoveryScreenResult> {
    const records: Array<{
      itemId: string
      title: string
      abstract: string
      year: number | null
      venue: string
    }> = []
    const skipped: DiscoveryScreenResult['outcomes'] = []
    for (const itemId of request.itemIds) {
      const view = await this.options.get(itemId)
      if (!view) {
        skipped.push({
          itemId,
          decision: 'undecided',
          reason: 'The record is no longer in the library.',
          failed: true
        })
        continue
      }
      records.push({
        itemId,
        title: view.item.title,
        abstract: view.item.abstract ?? '',
        year: view.item.issuedYear ?? null,
        venue: view.item.containerTitle ?? ''
      })
    }
    const model = await this.options.model()
    const outcomes = await screenRecords(
      model,
      records,
      { mode: request.criteria.mode, items: request.criteria.items, notes: request.criteria.notes },
      signal
    )
    const all = [...outcomes, ...skipped]
    return {
      outcomes: all,
      includeCount: all.filter((entry) => entry.decision === 'include').length,
      excludeCount: all.filter((entry) => entry.decision === 'exclude').length,
      undecidedCount: all.filter((entry) => entry.decision === 'undecided').length,
      failedCount: all.filter((entry) => entry.failed).length
    }
  }
}

export type { DiscoverySourceId }
