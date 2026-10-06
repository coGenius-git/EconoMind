import type { LiteratureItemInput, LiteratureItemView } from '../../../shared/literature'
import {
  type DiscoveryCandidate,
  type DiscoveryParseRecordsRequest,
  type DiscoveryParseRecordsResult,
  type DiscoveryDocumentType,
  type DiscoveryImportRequest,
  type DiscoveryImportResult,
  type DiscoveryQuery,
  type DiscoveryScreenRequest,
  type DiscoveryScreenResult,
  type DiscoverySearchResponse,
  type DiscoverySourceId
} from '../../../shared/literature-discovery'
import {
  readCnkiSignInState,
  openCnkiSignIn,
  signOutCnki,
  type CnkiSignInState
} from './cnki-browser'
import { searchCnki } from './cnki-provider'
import { parseCnkiRecords } from './cnki-records'
import { CnkiPdfDownloadError } from './cnki-pdf-download'
import { createOpenAlexSearch, type DiscoveryProviderResult } from './openalex-provider'
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
    shortTitle: '',
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
  acquirePdf?: (
    itemId: string,
    candidate: DiscoveryCandidate
  ) => Promise<'downloaded' | 'existing' | 'not-found'>
}

export class LiteratureDiscovery {
  private readonly searchOpenAlex: ReturnType<typeof createOpenAlexSearch>
  constructor(private readonly options: LiteratureDiscoveryOptions) {
    this.searchOpenAlex = createOpenAlexSearch({
      fetch: options.fetch,
      apiKey: options.openAlexKey
    })
  }

  async search(query: DiscoveryQuery, signal?: AbortSignal): Promise<DiscoverySearchResponse> {
    const settled = await Promise.all(
      query.sources.map(async (source): Promise<DiscoveryProviderResult> =>
        source === 'cnki' ? searchCnki(query) : this.searchOpenAlex(query, signal)
      )
    )

    const warnings: string[] = []
    const candidates: DiscoveryCandidate[] = []
    const seen = new Set<string>()
    let duplicatesRemoved = 0
    for (const result of settled) {
      if (result.status.unresolvedTiers.length)
        warnings.push(
          `${result.status.source === 'cnki' ? 'CNKI' : 'OpenAlex'} cannot filter by ${result.status.unresolvedTiers.join(', ')}; those criteria were not applied.`
        )
      if (result.status.message) warnings.push(result.status.message)
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
        'CNKI search results do not include abstracts; screening uses the title and metadata only.'
      )

    return {
      candidates,
      statuses: settled.map((result) => result.status),
      warnings: [...new Set(warnings)].slice(0, 20)
    }
  }

  async import(request: DiscoveryImportRequest): Promise<DiscoveryImportResult> {
    const imported: DiscoveryImportResult['imported'] = []
    // The catalog returns unique IDs, not one ID per input. Import each candidate through the
    // existing duplicate policy so a reused row cannot shift later key-to-item associations.
    for (const candidate of request.candidates) {
      const receipt = await this.options.importItems(
        [candidateToItemInput(candidate)],
        request.collectionId,
        request.duplicatePolicy
      )
      const itemId = receipt.itemIds[0]
      if (itemId) imported.push({ key: candidate.key, itemId })
    }
    const matchedKeys = new Set(imported.map((entry) => entry.key))
    const fullText: NonNullable<DiscoveryImportResult['fullText']> = []
    if (this.options.acquirePdf) {
      const targets = new Map<string, DiscoveryCandidate>()
      for (const entry of imported) {
        const candidate = request.candidates.find((candidate) => candidate.key === entry.key)
        if (candidate && !targets.has(entry.itemId)) targets.set(entry.itemId, candidate)
      }
      const pending = [...targets]
      let index = 0
      await Promise.all(
        Array.from({ length: Math.min(3, pending.length) }, async () => {
          while (index < pending.length) {
            const [itemId, candidate] = pending[index++]!
            let status: NonNullable<DiscoveryImportResult['fullText']>[number]['status']
            let reason: NonNullable<DiscoveryImportResult['fullText']>[number]['reason']
            try {
              status = await this.options.acquirePdf!(itemId, candidate)
            } catch (error) {
              status = 'failed'
              if (error instanceof CnkiPdfDownloadError) reason = error.reason
            }
            fullText.push({ key: candidate.key, itemId, status, ...(reason ? { reason } : {}) })
          }
        })
      )
      fullText.sort(
        (a, b) =>
          request.candidates.findIndex((entry) => entry.key === a.key) -
          request.candidates.findIndex((entry) => entry.key === b.key)
      )
    }
    const skipped = request.candidates
      .filter((candidate) => !matchedKeys.has(candidate.key))
      .map((candidate) => ({
        key: candidate.key,
        reason: 'Merged into an existing library record.'
      }))
    return {
      imported,
      skipped,
      importedCount: new Set(imported.map((entry) => entry.itemId)).size,
      fullText
    }
  }

  // Reads a CNKI export (RefWorks/RIS or EndNote) into the same candidate shape the online search
  // produces, so both sources continue through one review, import and screening flow.
  // The CNKI session lives in a standalone Chromium profile that the user signs in to once.
  async signInCnki(): Promise<CnkiSignInState> {
    return openCnkiSignIn()
  }

  async signOutCnki(): Promise<CnkiSignInState> {
    return signOutCnki()
  }

  async getCnkiSignInState(): Promise<CnkiSignInState> {
    return readCnkiSignInState()
  }

  parseRecords(request: DiscoveryParseRecordsRequest): DiscoveryParseRecordsResult {
    const parsed = parseCnkiRecords(request.content)
    return { format: parsed.format, candidates: parsed.candidates, errors: parsed.errors }
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
    for (const itemId of new Set(request.itemIds)) {
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
