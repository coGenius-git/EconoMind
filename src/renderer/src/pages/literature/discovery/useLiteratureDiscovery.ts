import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DISCOVERY_DEFAULT_LIMIT,
  DISCOVERY_DOCUMENT_TYPES,
  DISCOVERY_RESULT_LIMIT,
  DISCOVERY_SOURCE_IDS,
  DISCOVERY_SOURCE_TIERS,
  type DiscoveryCandidate,
  type DiscoveryDocumentType,
  type DiscoveryImportResult,
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
  sources: [...DISCOVERY_SOURCE_IDS]
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
  const [form, setForm] = useState<DiscoveryFormState>(emptyDiscoveryForm)
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [statuses, setStatuses] = useState<DiscoverySourceStatus[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [screening, setScreening] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [importResult, setImportResult] = useState<DiscoveryImportResult>()
  const [screenResult, setScreenResult] = useState<DiscoveryScreenResult>()
  const [cnkiSignedIn, setCnkiSignedIn] = useState(false)
  const { t } = useTranslation()

  const update = useCallback(
    <Key extends keyof DiscoveryFormState>(key: Key, value: DiscoveryFormState[Key]): void => {
      setForm((current) => ({ ...current, [key]: value }))
    },
    []
  )

  const toggleSource = useCallback((source: DiscoverySourceId): void => {
    setForm((current) => ({
      ...current,
      sources: current.sources.includes(source)
        ? current.sources.filter((entry) => entry !== source)
        : [...current.sources, source]
    }))
  }, [])

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

  const refreshCnkiState = useCallback(async (): Promise<void> => {
    try {
      const state = await window.api.literature.discoveryStatus('cnki')
      setCnkiSignedIn(state.signedIn)
    } catch {
      // Reading the session is best effort; the search result reports the authoritative state.
    }
  }, [])

  const buildQuery = useCallback((): Parameters<
    typeof window.api.literature.discoverySearch
  >[0] => {
    const limit = Math.min(DISCOVERY_RESULT_LIMIT, Math.max(1, Math.trunc(form.limit) || 1))
    return {
      topic: form.topic.trim(),
      keywords: form.keywords
        .split(/[,，\n]/u)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 20),
      yearFrom: parseYear(form.yearFrom),
      yearTo: parseYear(form.yearTo),
      documentTypes: form.documentTypes.filter((type) => DISCOVERY_DOCUMENT_TYPES.includes(type)),
      sourceTiers: form.sourceTiers.filter((tier) => DISCOVERY_SOURCE_TIERS.includes(tier)),
      minCitations: parseCount(form.minCitations),
      limit,
      sources: form.sources.length ? form.sources : ['openalex']
    }
  }, [form])

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
      const result = await window.api.literature.discoverySearch(buildQuery())
      setCandidates(result.candidates)
      setStatuses(result.statuses)
      setWarnings(result.warnings)
      setSelected(new Set())
      if (!result.candidates.length)
        setNotice(
          result.statuses.find((status) => status.requiresLogin)?.message ||
            t('No records matched this query.')
        )
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : t('The search failed.'))
      setCandidates([])
    } finally {
      setSearching(false)
    }
  }, [buildQuery, form.topic, t])

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

  const signInCnki = useCallback(async (): Promise<void> => {
    try {
      setNotice(t('Sign in to CNKI in the window that opened, then close it.'))
      // Resolves once the sign-in window is closed, so the reported state is the session that
      // actually exists afterwards rather than a placeholder.
      const result = await window.api.literature.discoverySignIn('cnki')
      setCnkiSignedIn(result.signedIn)
      setNotice(result.signedIn ? t('CNKI session ready') : result.message)
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : t('Unable to open CNKI.'))
    }
  }, [t])

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

  const requiresCnkiSignIn = useMemo(
    () => statuses.some((status) => status.source === 'cnki' && status.requiresLogin),
    [statuses]
  )

  return {
    form,
    update,
    toggleSource,
    toggleDocumentType,
    toggleSourceTier,
    candidates,
    statuses,
    warnings,
    selected,
    searching,
    importing,
    screening,
    error,
    notice,
    importResult,
    screenResult,
    cnkiSignedIn,
    requiresCnkiSignIn,
    search,
    importSelected,
    screenImported,
    signInCnki,
    refreshCnkiState,
    toggleSelection,
    selectAll,
    setError,
    setNotice
  }
}

export type LiteratureDiscoveryController = Readonly<{
  form: DiscoveryFormState
  update: <Key extends keyof DiscoveryFormState>(key: Key, value: DiscoveryFormState[Key]) => void
  toggleSource: (source: DiscoverySourceId) => void
  toggleDocumentType: (type: DiscoveryDocumentType) => void
  toggleSourceTier: (tier: DiscoverySourceTier) => void
  candidates: DiscoveryCandidate[]
  statuses: DiscoverySourceStatus[]
  warnings: string[]
  selected: ReadonlySet<string>
  searching: boolean
  importing: boolean
  screening: boolean
  error: string | undefined
  notice: string | undefined
  importResult: DiscoveryImportResult | undefined
  screenResult: DiscoveryScreenResult | undefined
  cnkiSignedIn: boolean
  requiresCnkiSignIn: boolean
  search: () => Promise<void>
  importSelected: (duplicatePolicy: 'reuse' | 'separate') => Promise<void>
  screenImported: (criteria: {
    mode: 'all' | 'any' | 'custom'
    items: string[]
    notes: string
  }) => Promise<void>
  signInCnki: () => Promise<void>
  refreshCnkiState: () => Promise<void>
  toggleSelection: (key: string) => void
  selectAll: (value: boolean) => void
  setError: Dispatch<SetStateAction<string | undefined>>
  setNotice: Dispatch<SetStateAction<string | undefined>>
}>
