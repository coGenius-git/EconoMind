import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DISCOVERY_DEFAULT_LIMIT,
  DISCOVERY_DOCUMENT_TYPES,
  DISCOVERY_RESULT_LIMIT,
  OPENALEX_DISCOVERY_SOURCE_TIERS,
  type DiscoveryCandidate,
  type DiscoveryDocumentType,
  type DiscoveryImportResult,
  type DiscoveryQuery,
  type DiscoveryScreenResult,
  type DiscoverySourceId,
  type DiscoverySourceStatus,
  type DiscoverySourceTier
} from '../../../../../shared/literature-discovery'

export type DiscoveryFormState = {
  topic: string
  keywords: string
  yearFrom: string
  yearTo: string
  documentTypes: DiscoveryDocumentType[]
  sourceTiers: DiscoverySourceTier[]
  minCitations: string
  limit: number
  sources: DiscoverySourceId[]
  language: NonNullable<DiscoveryQuery['language']> | ''
  sort: NonNullable<DiscoveryQuery['sort']>
}

export const emptyDiscoveryForm: DiscoveryFormState = {
  topic: '',
  keywords: '',
  yearFrom: '',
  yearTo: '',
  documentTypes: [],
  sourceTiers: [],
  minCitations: '',
  limit: DISCOVERY_DEFAULT_LIMIT,
  sources: ['openalex'],
  language: '',
  sort: 'relevance'
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
  const [signingIn, setSigningIn] = useState(false)
  const [cnkiSignedIn, setCnkiSignedIn] = useState(false)
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

  const toggleSource = useCallback((source: DiscoverySourceId): void => {
    setForm((current) => ({
      ...current,
      sources: current.sources.includes(source)
        ? current.sources.filter((entry) => entry !== source)
        : [...current.sources, source]
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
      setError(t('Enter search terms before searching.'))
      return
    }
    const yearFrom = parseYear(form.yearFrom)
    const yearTo = parseYear(form.yearTo)
    if (
      (form.yearFrom.trim() && (!yearFrom || yearFrom < 1000)) ||
      (form.yearTo.trim() && (!yearTo || yearTo < 1000))
    ) {
      setError(t('Enter a four-digit publication year.'))
      return
    }
    if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) {
      setError(t('Publication year from must not exceed publication year to.'))
      return
    }
    const minCitations = parseCount(form.minCitations)
    if (form.minCitations.trim() && (minCitations === null || minCitations > 10_000_000)) {
      setError(t('Enter a non-negative citation count.'))
      return
    }
    setSearching(true)
    try {
      const result = await window.api.literature.discoverySearch({
        topic: form.topic.trim(),
        keywords: keywords(),
        yearFrom,
        yearTo,
        documentTypes: form.documentTypes.filter((type) => DISCOVERY_DOCUMENT_TYPES.includes(type)),
        sourceTiers: form.sourceTiers.filter((tier) =>
          OPENALEX_DISCOVERY_SOURCE_TIERS.some((supported) => supported === tier)
        ),
        minCitations,
        language: form.language || null,
        sort: form.sort,
        limit: Math.min(DISCOVERY_RESULT_LIMIT, Math.max(1, Math.trunc(form.limit) || 1)),
        sources: ['openalex']
      })
      setCandidates(result.candidates)
      setStatuses(result.statuses)
      const providerMessages = new Set(
        result.statuses.map((status) => status.message).filter(Boolean)
      )
      const warnings = result.warnings.filter((warning) => !providerMessages.has(warning))
      for (const status of result.statuses) {
        if (status.source === 'openalex' && status.failureCode === 'rate-limited') {
          warnings.push(
            status.rateLimitReason === 'daily-budget'
              ? status.requiresApiKey
                ? t(
                    'OpenAlex daily budget is exhausted. Configure a free OpenAlex API key to use your own budget, or wait for the reset.'
                  )
                : t(
                    'OpenAlex daily budget is exhausted. Wait for the reset or update your API key.'
                  )
              : t(
                  'OpenAlex is temporarily rate limited. Automatic retries did not succeed. Try again after the waiting period.'
                )
          )
          if (status.retryAt)
            warnings.push(
              t('Retry after {{time}}.', { time: new Date(status.retryAt).toLocaleString() })
            )
        } else if (status.message) warnings.push(status.message)
      }
      setWarnings(warnings)
      setSelected(new Set())
      if (!result.candidates.length && !providerMessages.size)
        setNotice(t('No records matched this query.'))
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : t('The search failed.'))
      setCandidates([])
    } finally {
      setSearching(false)
    }
  }, [form, keywords, t])

  const signInCnki = useCallback(async (): Promise<void> => {
    try {
      setSigningIn(true)
      setNotice(t('Sign in to CNKI in the window that opened, then close it.'))
      const state = await window.api.literature.discoverySignIn('cnki')
      setCnkiSignedIn(state.signedIn)
      setNotice(state.signedIn ? t('CNKI session ready') : state.message)
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : t('Unable to open CNKI.'))
    } finally {
      setSigningIn(false)
    }
  }, [t])

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
    async (duplicatePolicy: 'reuse' | 'separate'): Promise<DiscoveryImportResult | undefined> => {
      const chosen = candidates.filter((candidate) => selected.has(candidate.key))
      if (!chosen.length) {
        setError(t('Select at least one record to import.'))
        return undefined
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
        return result
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : t('The import failed.'))
        return undefined
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
      const itemIds = [...new Set((importResult?.imported ?? []).map((entry) => entry.itemId))]
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
      else if (next.size < DISCOVERY_RESULT_LIMIT) next.add(key)
      return next
    })
  }, [])

  const selectAll = useCallback(
    (value: boolean): void => {
      setSelected(
        value
          ? new Set(candidates.slice(0, DISCOVERY_RESULT_LIMIT).map((candidate) => candidate.key))
          : new Set()
      )
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
    signingIn,
    cnkiSignedIn,
    error,
    notice,
    importResult,
    screenResult,
    toggleSource,
    search,
    signInCnki,
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
  signingIn: boolean
  cnkiSignedIn: boolean
  error: string | undefined
  notice: string | undefined
  importResult: DiscoveryImportResult | undefined
  screenResult: DiscoveryScreenResult | undefined
  toggleSource: (source: DiscoverySourceId) => void
  search: () => Promise<void>
  signInCnki: () => Promise<void>
  importCnkiExport: (file: File) => Promise<void>
  importSelected: (
    duplicatePolicy: 'reuse' | 'separate'
  ) => Promise<DiscoveryImportResult | undefined>
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
