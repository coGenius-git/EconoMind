import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderOpen,
  LoaderCircle,
  Search,
  Settings2,
  Sparkles,
  Users
} from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorNotice } from '@/components/error-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSpecialistStore } from '@/stores/specialist-store'
import { SpecialistAvatar } from '../settings/specialist-avatar'
import { builtinSpecialistExample } from '../workspace/builtin-specialist-examples'
import { specialistTasks, type BrowsableSpecialist } from './specialist-browser-model'

export type SpecialistBrowserProps = {
  projectName?: string
  canSummon: boolean
  summonDisabledReason?: string
  onSummon: (specialistId: string) => void
  onManage: () => void
  onBack: () => void
}

type SourceFilter = 'all' | 'builtin' | 'custom'

export const SpecialistBrowser = ({
  projectName,
  canSummon,
  summonDisabledReason,
  onSummon,
  onManage,
  onBack
}: SpecialistBrowserProps): React.JSX.Element => {
  const { t } = useTranslation()
  const items = useSpecialistStore((state) => state.items)
  const isLoaded = useSpecialistStore((state) => state.isLoaded)
  const loadError = useSpecialistStore((state) => state.loadError)
  const integrity = useSpecialistStore((state) => state.integrity)
  const load = useSpecialistStore((state) => state.load)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SourceFilter>('all')
  const [selectedId, setSelectedId] = useState<string>()
  const [retrying, setRetrying] = useState(false)
  const headingId = useId()
  const detailId = useId()
  const reasonId = useId()
  const apiAvailable = typeof window.api?.specialist?.list === 'function'

  useEffect(() => {
    // load() also subscribes to catalog changes, including when its snapshot is cached.
    void load().catch(() => undefined)
  }, [load])

  const specialists = items.filter((item): item is BrowsableSpecialist => item.kind !== 'reviewer')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visible = specialists.filter(
    (item) =>
      (filter === 'all' || item.kind === filter) &&
      `${item.displayName ?? ''} ${item.name} ${item.description}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
  )
  // A filter or live catalog removal cannot leave a stale, hidden profile selected.
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0]
  const tasks = selected ? specialistTasks(selected.systemPrompt) : []
  const example = builtinSpecialistExample(selected, t)
  const loading = !isLoaded && !loadError && apiAvailable
  const degraded = integrity.status === 'degraded'
  const blockedReason = !apiAvailable
    ? t('Specialists are unavailable here.')
    : loadError
      ? t('EconoMind could not load Specialists. Retry to continue.')
      : degraded
        ? t('Specialist data must be repaired before summoning.')
        : !isLoaded || retrying
          ? t('Loading…')
          : selected?.setupPending
            ? t('This Specialist needs setup. Complete it in Manage Specialists.')
            : selected && !selected.enabled
              ? t('This Specialist is disabled. Enable it in Manage Specialists.')
              : !canSummon
                ? (summonDisabledReason ?? t('Open a project to summon a Specialist.'))
                : undefined

  const retry = (): void => {
    setRetrying(true)
    void load({ force: true })
      .catch(() => undefined)
      .finally(() => setRetrying(false))
  }

  const filters: { value: SourceFilter; label: string }[] = [
    { value: 'all', label: t('All') },
    { value: 'builtin', label: t('Built-in') },
    { value: 'custom', label: t('Custom') }
  ]

  return (
    <section
      id="specialist-browser"
      className="research-glass specialist-browser min-h-0 h-full flex-1 overflow-y-auto rounded-3xl text-text-000"
      aria-labelledby={headingId}
      data-testid="specialist-browser"
    >
      <div className="specialist-browser-inner">
        <header className="specialist-browser-header">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              {t('Back to conversation')}
            </Button>
            <h1 id={headingId} className="text-2xl font-semibold tracking-tight">
              {t('Specialists')}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('Choose a Specialist for your research task.')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {projectName ? (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="max-w-48 truncate" title={projectName}>
                  {projectName}
                </span>
              </span>
            ) : null}
            <Button variant="outline" onClick={onManage}>
              <Settings2 aria-hidden="true" />
              {t('Manage Specialists')}
            </Button>
          </div>
        </header>

        <div className="specialist-browser-toolbar">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              aria-label={t('Search specialists')}
              placeholder={t('Search specialists…')}
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-border bg-bg-000/70 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:keyboard-focus"
            />
          </div>
          <div
            className="flex shrink-0 gap-1 rounded-lg border border-border p-1"
            role="group"
            aria-label={t('Specialists')}
          >
            {filters.map(({ value, label }) => (
              <Button
                key={value}
                variant="ghost"
                size="sm"
                aria-pressed={filter === value}
                className={cn(filter === value && 'bg-bg-000 text-text-000 shadow-sm')}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {loadError ? (
          <ErrorNotice
            role="alert"
            className="mb-5"
            description={t('EconoMind could not load Specialists. Retry to continue.')}
            primaryButton={{ label: t('Retry'), onClick: retry, loading: retrying }}
          />
        ) : degraded ? (
          <ErrorNotice
            tone="red"
            role="alert"
            className="mb-5"
            title={t('Some Specialist data could not be read.')}
            description={t('Specialist data must be repaired before summoning.')}
            primaryButton={{ label: t('Retry'), onClick: retry, loading: retrying }}
            secondaryButton={{ label: t('Manage Specialists'), onClick: onManage }}
          />
        ) : !apiAvailable ? (
          <ErrorNotice
            role="status"
            className="mb-5"
            description={t('Specialists are unavailable here.')}
          />
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground" role="status">
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {t('Loading…')}
          </p>
        ) : (
          <div className="specialist-browser-layout">
            <div className="specialist-browser-directory min-w-0">
              <p className="mb-3 text-xs text-muted-foreground" role="status">
                <span className="tabular-nums">{visible.length}</span> {t('Specialists')}
              </p>
              {visible.length ? (
                <ul className="specialist-browser-cards">
                  {visible.map((item) => (
                    <li key={item.id} className="min-w-0">
                      <button
                        type="button"
                        className="specialist-browser-card"
                        aria-pressed={selected?.id === item.id}
                        aria-controls={detailId}
                        data-specialist-id={item.id}
                        data-testid={`specialist-card-${item.id}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className="flex items-start gap-3">
                          <SpecialistAvatar iconKey={item.iconKey} colorKey={item.colorKey} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold leading-5 break-words">
                              {item.displayName ?? item.name}
                            </span>
                            <span className="mt-1.5 flex flex-wrap gap-1.5">
                              <Badge variant="secondary">
                                {item.kind === 'builtin' ? t('Built-in') : t('Custom')}
                              </Badge>
                              {item.setupPending ? (
                                <Badge variant="outline">{t('Setup incomplete')}</Badge>
                              ) : !item.enabled ? (
                                <Badge variant="outline">{t('Disabled')}</Badge>
                              ) : null}
                            </span>
                          </span>
                        </span>
                        <span className="my-2 text-xs leading-5 text-muted-foreground line-clamp-2">
                          {item.description}
                        </span>
                        <span className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-2 text-xs">
                          <span>
                            {item.capabilityMode === 'full'
                              ? t('Full access')
                              : t('Selected capabilities')}
                          </span>
                          {selected?.id === item.id ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : (
                            <ArrowRight className="size-4" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="specialist-browser-empty">
                  <Users className="mb-3 size-6 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-sm font-semibold">
                    {normalizedQuery
                      ? t('No Specialists match your search.')
                      : filter === 'all'
                        ? t('No Specialists installed yet.')
                        : t('No Specialists in this category.')}
                  </h2>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {t('Browse another category or manage your Specialists.')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setQuery('')
                      setFilter('all')
                    }}
                  >
                    {t('Clear filters')}
                  </Button>
                </div>
              )}
            </div>

            <aside
              id={detailId}
              className="specialist-browser-detail"
              aria-label={t('Specialist details')}
              data-testid="specialist-browser-detail"
            >
              <p className="mb-3 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" />
                {t('Specialist details')}
              </p>
              {selected ? (
                <>
                  <div className="flex shrink-0 items-center gap-3">
                    <SpecialistAvatar
                      iconKey={selected.iconKey}
                      colorKey={selected.colorKey}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold leading-7 break-words">
                        {selected.displayName ?? selected.name}
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        {selected.kind === 'builtin' ? t('Built-in') : t('Custom')}
                      </span>
                    </div>
                  </div>
                  <div
                    className="specialist-browser-detail-reading focus-visible:keyboard-focus"
                    tabIndex={0}
                    role="region"
                    aria-label={t('Role and tasks')}
                    data-testid="specialist-detail-reading"
                  >
                    <p className="mb-4 text-xs leading-6 text-muted-foreground">
                      {selected.description}
                    </p>
                    {tasks.length ? (
                      <section className="border-t border-border pt-4">
                        <h3 className="mb-3 text-xs font-semibold">{t('Role and tasks')}</h3>
                        <ul className="space-y-3">
                          {tasks.map((task, index) => (
                            <li
                              key={index}
                              className="flex gap-2 text-xs leading-6 text-muted-foreground"
                            >
                              <Check className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    {selected.systemPrompt && !tasks.length ? (
                      <details className="border-t border-border pt-4">
                        <summary className="cursor-pointer rounded text-xs font-semibold focus-visible:keyboard-focus">
                          {t('Configured instructions')}
                        </summary>
                        <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
                          {selected.systemPrompt}
                        </p>
                      </details>
                    ) : null}
                    <section className="mt-4 border-t border-border pt-4">
                      <h3 className="mb-2 text-xs font-semibold">{t('Capabilities')}</h3>
                      <p className="text-xs leading-6 text-muted-foreground">
                        {selected.capabilityMode === 'full'
                          ? t('Full access')
                          : t('Selected capabilities')}
                      </p>
                      {selected.capabilityMode === 'selected' ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            {t('Skills')} {selected.selectedCapabilities.skillIds.length}
                          </Badge>
                          <Badge variant="secondary">
                            {t('Connectors')} {selected.selectedCapabilities.connectorIds.length}
                          </Badge>
                        </div>
                      ) : null}
                    </section>
                    {example ? (
                      <section className="mt-4">
                        <h3 className="mb-3 text-xs font-semibold">{t('Try starting with')}</h3>
                        <p
                          tabIndex={0}
                          aria-label={t('Try starting with')}
                          className="specialist-browser-example whitespace-pre-wrap break-words text-xs leading-6 focus-visible:keyboard-focus"
                        >
                          {example}
                        </p>
                      </section>
                    ) : null}
                  </div>
                  <div className="specialist-browser-detail-action">
                    <Button
                      className="h-auto min-h-10 w-full whitespace-normal py-2"
                      disabled={Boolean(blockedReason)}
                      aria-describedby={reasonId}
                      onClick={() => {
                        if (!blockedReason) onSummon(selected.id)
                      }}
                      data-testid="specialist-summon"
                    >
                      <Sparkles aria-hidden="true" />
                      {t('Summon Specialist')}
                    </Button>
                    <p
                      id={reasonId}
                      className="mt-2 text-center text-[11px] leading-5 text-muted-foreground"
                    >
                      {blockedReason ??
                        t(
                          'Opens a new conversation in this project. Edit your task before sending.'
                        )}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                  {t('Select a Specialist to view details.')}
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  )
}
