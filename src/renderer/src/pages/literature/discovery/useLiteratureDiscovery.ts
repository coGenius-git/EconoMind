import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DISCOVERY_DEFAULT_LIMIT,
  DISCOVERY_DOCUMENT_TYPES,
  DISCOVERY_RESULT_LIMIT,
  DISCOVERY_SOURCE_TIERS,
  type DiscoveryCandidate,
  type DiscoveryDocumentType,
  type DiscoveryImportResult,
  type DiscoveryScreenResult,
  type DiscoverySourceStatus,
  type DiscoverySourceTier
} from '../../../../../shared/literature-discovery'

// CNKI is searched in the user's own browser: the app cannot sign in there, and the main window
// already hands external links to the system browser.
const CNKI_SEARCH_URL = 'https://kns.cnki.net/kns8s/defaultresult/index'

export type DiscoveryFormState = {
  topic: string
  keywords: string
  yearFrom: string
  yearTo: string
  documentTypes: DiscoveryDocumentType[]
  sourceTiers: DiscoverySourceTier[]
  minCitations: string
  limit: number
}

export const emptyDiscoveryForm: DiscoveryFormState = {
  topic: '',
  keywords: '',
  yearFrom: '',
  yearTo: '',
  documentTypes: [],
  sourceTiers: [],
  minCitations: '',
  limit: DISCOVERY_DEFAULT_LIMIT
}

function parseYear(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d{4}$/u.test(trimmed)) return null
  return Number(trimmed)
}

function parseCount(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/u.test(trimmed)) return null
  return Number(trimmed)
}

export function useLiteratureDiscovery(collectionId?: string): LiteratureDiscoveryController {
  const { t } = useTranslation()
  const [form, setForm] = useState<DiscoveryFormState>(emptyDiscoveryForm)
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [statuses, setStatuses] = useState<DiscoverySourceStatus[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [screening, setScreening] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [importResult, setImportResult] = useState<DiscoveryImportResult>()
  const [screenResult, setScreenResult] = useState<DiscoveryScreenResult>()

  const update = useCallback(
    <Key extends keyof DiscoveryFormState>(key: Key, value: DiscoveryFormState[Key]): void => {
      setForm((current) => ({ ...current, [key]: value }))
    },
    []
  )

  const toggleDocumentType = useCallback((type: DiscoveryDocumentType): void => {
    setForm((current) => ({
      ...current,
      documentTypes: current.documentTypes.includes(type)
        ? current.documentTypes.filter((entry) => entry !== type)
        : [...current.documentTypes, type]
    }))
  }, [])

  const toggleSourceTier = useCallback((tier: DiscoverySourceTier): void => {
    setForm((current) => ({
      ...current,
      sourceTiers: current.sourceTiers.includes(tier)
        ? current.sourceTiers.filter((entry) => entry !== tier)
        : [...current.sourceTiers, tier]
    }))
  }, [])

  const keywords = useCallback(
    (): string[] =>
      form.keywords
        .split(/[,，\n]/u)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 20),
    [form.keywords]
  )

  const search = useCallback(async (): Promise<void> => {
    setError(undefined)
    setNotice(undefined)
    setImportResult(undefined)
    setScreenResult(undefined)
    if (!form.topic.trim()) {
      setError(t('Enter a review topic before searching.'))
      return
    }
    setSearching(true)
    try {
      const result = await window.api.literature.discoverySearch({
        topic: form.topic.trim(),
        keywords: keywords(),
        yearFrom: parseYear(form.yearFrom),
        yearTo: parseYear(form.yearTo),
        documentTypes: form.documentTypes.filter((type) => DISCOVERY_DOCUMENT_TYPES.includes(type)),
        sourceTiers: form.sourceTiers.filter((tier) => DISCOVERY_SOURCE_TIERS.includes(tier)),
        minCitations: parseCount(form.minCitations),
        limit: Math.min(DISCOVERY_RESULT_LIMIT, Math.max(1, Math.trunc(form.limit) || 1)),
        sources: ['openalex']
      })
      setCandidates(result.candidates)
      setStatuses(result.statuses)
      setWarnings(result.warnings)
      setSelected(new Set())
      if (!result.candidates.length)
        setNotice(
          result.statuses.find((status) => status.message)?.message ??
            t('No records matched this query.')
        )
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : t('The search failed.'))
      setCandidates([])
    } finally {
      setSearching(false)
    }
  }, [form, keywords, t])

  // Opens CNKI with the topic already filled in. The main window routes external links to the
  // system browser, where the user's own CNKI session and institutional access already work.
  const openCnkiSearch = useCallback((): void => {
    const text = [form.topic, ...keywords()].join(' ').trim()
    const params = new URLSearchParams({ kw: text, korder: 'SU' })
    window.open(`${CNKI_SEARCH_URL}?${params.toString()}`, '_blank', 'noopener')
    setNotice(
      t(
        'Export the selected references as RefWorks or EndNote from CNKI, then import that file here.'
      )
    )
  }, [form.topic, keywords, t])

  const importCnkiExport = useCallback(
    async (file: File): Promise<void> => {
      setParsing(true)
      setError(undefined)
      try {
        const content = await file.text()
        const result = await window.api.literature.discoveryParseRecords({ content })
        if (!result.candidates.length) {
          setError(result.errors.join(' ') || t('No records matched this query.'))
          return
        }
        // Exported records join whatever the online search already found.
        setCandidates((current) => {
          const seen = new Set(current.map((candidate) => candidate.key))
          return [...current, ...result.candidates.filter((candidate) => !seen.has(candidate.key))]
        })
        setNotice(`${t('Records')}: ${result.candidates.length}`)
      } catch (parseError) {
        setError(parseError instanceof Error ? parseError.message : t('The import failed.'))
      } finally {
        setParsing(false)
      }
    },
    [t]
  )

  const importSelected = useCallback(
    async (duplicatePolicy: 'reuse' | 'separate'): Promise<void> => {
      const chosen = candidates.filter((candidate) => selected.has(candidate.key))
      if (!chosen.length) {
        setError(t('Select at least one record to import.'))
        return
      }
      setImporting(true)
      setError(undefined)
      try {
        const result = await window.api.literature.discoveryImport({
          collectionId: collectionId ?? null,
          duplicatePolicy,
          candidates: chosen
        })
        setImportResult(result)
        setNotice(`${t('Imported records')}: ${result.importedCount}`)
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : t('The import failed.'))
      } finally {
        setImporting(false)
      }
    },
    [candidates, collectionId, selected, t]
  )

  const screenImported = useCallback(
    async (criteria: {
      mode: 'all' | 'any' | 'custom'
      items: string[]
      notes: string
    }): Promise<void> => {
      const itemIds = (importResult?.imported ?? []).map((entry) => entry.itemId)
      if (!itemIds.length) {
        setError(t('Import records before screening them.'))
        return
      }
      const items = criteria.items.map((value) => value.trim()).filter(Boolean)
      if (!items.length) {
        setError(t('Add at least one inclusion criterion.'))
        return
      }
      setScreening(true)
      setError(undefined)
      try {
        const result = await window.api.literature.discoveryScreen({
          itemIds,
          criteria: { mode: criteria.mode, items, notes: criteria.notes }
        })
        setScreenResult(result)
        setNotice(
          `${result.includeCount} included, ${result.excludeCount} excluded, ${result.undecidedCount} undecided.`
        )
      } catch (screenError) {
        setError(screenError instanceof Error ? screenError.message : t('Screening failed.'))
      } finally {
        setScreening(false)
      }
    },
    [importResult, t]
  )

  const toggleSelection = useCallback((key: string): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectAll = useCallback(
    (value: boolean): void => {
      setSelected(value ? new Set(candidates.map((candidate) => candidate.key)) : new Set())
    },
    [candidates]
  )

  return {
    form,
    update,
    toggleDocumentType,
    toggleSourceTier,
    candidates,
    statuses,
    warnings,
    selected,
    searching,
    importing,
    screening,
    parsing,
    error,
    notice,
    importResult,
    screenResult,
    search,
    openCnkiSearch,
    importCnkiExport,
    importSelected,
    screenImported,
    toggleSelection,
    selectAll,
    setError,
    setNotice
  }
}

export type LiteratureDiscoveryController = Readonly<{
  form: DiscoveryFormState
  update: <Key extends keyof DiscoveryFormState>(key: Key, value: DiscoveryFormState[Key]) => void
  toggleDocumentType: (type: DiscoveryDocumentType) => void
  toggleSourceTier: (tier: DiscoverySourceTier) => void
  candidates: DiscoveryCandidate[]
  statuses: DiscoverySourceStatus[]
  warnings: string[]
  selected: ReadonlySet<string>
  searching: boolean
  importing: boolean
  screening: boolean
  parsing: boolean
  error: string | undefined
  notice: string | undefined
  importResult: DiscoveryImportResult | undefined
  screenResult: DiscoveryScreenResult | undefined
  search: () => Promise<void>
  openCnkiSearch: () => void
  importCnkiExport: (file: File) => Promise<void>
  importSelected: (duplicatePolicy: 'reuse' | 'separate') => Promise<void>
  screenImported: (criteria: {
    mode: 'all' | 'any' | 'custom'
    items: string[]
    notes: string
  }) => Promise<void>
  toggleSelection: (key: string) => void
  selectAll: (value: boolean) => void
  setError: Dispatch<SetStateAction<string | undefined>>
  setNotice: Dispatch<SetStateAction<string | undefined>>
}>
