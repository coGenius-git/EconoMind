import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { LiteratureItemView } from '../../../../shared/literature'
import type {
  ScreeningRequest,
  ScreeningResponse,
  ScreeningWorkflow
} from '../../../../shared/literature-screening'
import { ScreeningSetup, ScreeningExport, type ScreeningMutate } from './ScreeningForms'
import { ScreeningReview } from './ScreeningReview'

const STEPS = [
  'Screening setup',
  'Full-text preparation',
  'Screening and review',
  'Viewpoint extraction',
  'Export results'
] as const
type Props = Readonly<{
  open: boolean
  onClose: () => void
  reviewProjectId?: string
  reviewProjectName?: string
  scope: Readonly<{ projectId?: string; collectionId?: string; scopeName?: string }>
}>
const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export function LiteratureScreeningWizard(props: Props): React.JSX.Element | null {
  return props.open ? <ScreeningWorkbench {...props} /> : null
}

function ScreeningWorkbench({
  onClose,
  reviewProjectId,
  reviewProjectName,
  scope
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<NonNullable<ScreeningResponse['workflows']>>([])
  const [workflow, setWorkflow] = useState<ScreeningWorkflow>()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selecting, setSelecting] = useState<'create' | 'add'>()
  const [candidates, setCandidates] = useState<LiteratureItemView[]>([])
  const [candidateOffset, setCandidateOffset] = useState<number>()
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const loadTasks = useCallback(async () => {
    if (!reviewProjectId) return
    try {
      const result = await window.api.literature.screening({
        action: 'list',
        projectId: reviewProjectId
      })
      if (mounted.current) setTasks(result.workflows ?? [])
    } catch (e) {
      if (mounted.current) setError(errorText(e))
    }
  }, [reviewProjectId])
  useEffect(() => {
    void Promise.resolve().then(loadTasks)
  }, [loadTasks])
  const running =
    !!workflow &&
    (workflow.runs.some((r) => r.state === 'running') ||
      workflow.documents.some(
        (d) =>
          d.parseStatus === 'running' ||
          d.screeningStatus === 'running' ||
          d.extractionStatus === 'running'
      ))
  useEffect(() => {
    if (!workflow?.id || !running) return
    let cancelled = false
    const timer = setInterval(() => {
      void window.api.literature
        .screening({ action: 'get', workflowId: workflow.id })
        .then((r) => {
          if (!cancelled && r.workflow)
            setWorkflow((current) =>
              !current || r.workflow!.updatedAt >= current.updatedAt ? r.workflow : current
            )
        })
        .catch((e) => {
          if (!cancelled) setError(errorText(e))
        })
    }, 1200)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [workflow?.id, running])
  const mutate: ScreeningMutate = async (request: ScreeningRequest) => {
    setBusy(true)
    setError('')
    try {
      const result = await window.api.literature.screening(request)
      if (mounted.current && result.workflow) setWorkflow(result.workflow)
      return result
    } catch (e) {
      if (mounted.current) setError(errorText(e))
      return undefined
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  const openTask = async (id: string): Promise<void> => {
    const result = await mutate({ action: 'get', workflowId: id })
    if (result?.workflow) {
      setStep(result.workflow.stage)
      setSelecting(undefined)
    }
  }
  const loadCandidates = async (offset = 0): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const page = await window.api.literature.search({
        scope: 'library',
        projectId: scope.projectId,
        collectionId: scope.collectionId,
        lifecycle: 'active',
        limit: 100,
        offset
      })
      const entries = page.entries.filter(
        (e): e is LiteratureItemView => 'item' in e && 'attachments' in e && 'projectIds' in e
      )
      setCandidates((previous) => (offset ? [...previous, ...entries] : entries))
      setCandidateOffset(page.nextOffset)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const beginSelection = (mode: 'create' | 'add'): void => {
    setSelecting(mode)
    setChosen(new Set())
    setName('')
    void loadCandidates()
  }
  const execute = (sample = false, retry = false): void => {
    if (workflow)
      void mutate({
        action: 'run',
        workflowId: workflow.id,
        expectedUpdatedAt: workflow.updatedAt,
        stage: step === 2 ? 'parse' : step === 3 ? 'screen' : 'extract',
        sample,
        retry
      })
  }
  const confirm = async (): Promise<void> => {
    if (!workflow) return
    if (
      step === 3 &&
      !workflow.documents.some(
        (d) => !d.deferred && (d.decision === 'included' || d.decision === 'excluded')
      )
    ) {
      setError(t('Include or exclude at least one reference before continuing.'))
      return
    }
    const result = await mutate({
      action: 'confirm',
      workflowId: workflow.id,
      expectedUpdatedAt: workflow.updatedAt,
      stage: step === 2 ? 'parse' : step === 3 ? 'screen' : 'extract',
      deferUnresolved: step === 3 && !!unresolved
    })
    if (result?.workflow) setStep(result.workflow.stage)
  }
  const latestRun = workflow?.runs.at(-1)
  const unresolved =
    workflow?.documents.filter((d) => !d.deferred && (!d.decision || d.decision === 'uncertain'))
      .length ?? 0
  const disabled = busy || running
  const stageEnabled = (value: number): boolean =>
    value <= 2 ||
    (value === 3 && !!workflow?.parseConfirmed) ||
    (value >= 4 && !!workflow?.screeningConfirmed)
  return (
    <section
      className="research-library-shell research-glass flex min-h-0 flex-1 overflow-hidden"
      aria-label={t('Literature screening')}
    >
      <aside className="research-library-sidebar flex w-44 shrink-0 flex-col border-r p-3 xl:w-48">
        <Button variant="ghost" className="justify-start px-2" onClick={onClose}>
          <ArrowLeft className="mr-2 size-4" />
          {t('Back to library')}
        </Button>
        <div className="mt-6 truncate px-2 text-xs text-muted-foreground">{scope.scopeName}</div>
        <h2 className="mt-2 px-2 font-semibold">{t('Literature screening')}</h2>
        <nav className="mt-6 space-y-2" aria-label={t('Screening stages')}>
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              disabled={!workflow || !!selecting || !stageEnabled(i + 1)}
              aria-current={step === i + 1 && !!workflow ? 'step' : undefined}
              onClick={() => setStep(i + 1)}
              className={cn(
                'research-sidebar-link flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
                step === i + 1 && workflow
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs">
                {i + 1}
              </span>
              {t(label)}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-border border-border border-border pt-4">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setWorkflow(undefined)
              setSelecting(undefined)
              void loadTasks()
            }}
          >
            {t('Screening tasks')}
          </Button>
          <p className="mt-2 px-2 text-xs leading-relaxed text-muted-foreground">
            {t('Each stage requires your confirmation. Tasks save automatically.')}
          </p>
        </div>
      </aside>
      <div className="research-library-content research-reading-surface flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border border-border border-border px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {t('Literature screening')}
              {workflow ? ` / ${t(STEPS[step - 1])}` : ''}
            </p>
            <h1 className="mt-1 truncate font-serif text-2xl font-semibold tracking-tight">
              {workflow && selecting !== 'create' ? workflow.config.name : t('Screening tasks')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {workflow && !selecting ? (
              <>
                <span className="mr-2 text-xs text-muted-foreground">
                  {t('References: {{total}}', { total: workflow.documents.length })}
                </span>
                {running ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void mutate({ action: 'pause', workflowId: workflow.id })}
                  >
                    <Pause className="mr-2 size-4" />
                    {t('Pause')}
                  </Button>
                ) : (
                  <Button variant="outline" disabled={busy} onClick={() => beginSelection('add')}>
                    <Plus className="mr-2 size-4" />
                    {t('Add references')}
                  </Button>
                )}
              </>
            ) : (
              <Button disabled={busy || !reviewProjectId} onClick={() => beginSelection('create')}>
                <Plus className="mr-2 size-4" />
                {t('New screening task')}
              </Button>
            )}
          </div>
        </header>
        {error ? (
          <div
            role="alert"
            className="mx-6 mt-3 rounded-lg border border-border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
            <Button
              variant="ghost"
              className="ml-3"
              onClick={() => {
                setError('')
                if (workflow) void openTask(workflow.id)
                else void loadTasks()
              }}
            >
              {t('Refresh')}
            </Button>
          </div>
        ) : null}
        {latestRun && workflow && !selecting ? (
          <div className="flex items-center gap-3 border-b border-border border-border border-border bg-muted/30 px-6 py-2 text-xs text-muted-foreground">
            {running ? <Loader2 className="size-3 animate-spin" /> : null}
            <span>
              {t('Processed {{done}} / {{total}} · failures {{failed}}', {
                done: latestRun.completedIds.length + latestRun.failedIds.length,
                total: latestRun.itemIds.length,
                failed: latestRun.failedIds.length
              })}
            </span>
            {latestRun.sample ? <span>{t('Sample results only')}</span> : null}
            {latestRun.error ? (
              <span role="alert" className="text-destructive">
                {latestRun.error}
              </span>
            ) : null}
          </div>
        ) : null}
        {selecting ? (
          <div className="min-h-0 flex-1 overflow-auto p-6">
            <div className="max-w-3xl space-y-4">
              <h2 className="text-lg font-semibold">
                {selecting === 'add' ? t('Add references') : t('New screening task')}
              </h2>
              {selecting === 'create' ? (
                <Input
                  aria-label={t('Task name')}
                  placeholder={t('Task name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              ) : null}
              <p className="text-sm text-muted-foreground">
                {t('Select references from this scope. Each task supports up to 1000 references.')}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setChosen(
                      new Set(
                        candidates
                          .filter(
                            (e) =>
                              selecting !== 'add' || !workflow?.documents.some((d) => d.id === e.id)
                          )
                          .map((e) => e.id)
                      )
                    )
                  }
                >
                  {t('Select loaded references')}
                </Button>
                <Button variant="ghost" onClick={() => setChosen(new Set())}>
                  {t('Clear selection')}
                </Button>
              </div>
              <div className="divide-y rounded-lg border border-border">
                {candidates.map((entry) => (
                  <label
                    key={entry.id}
                    className="flex cursor-pointer items-start gap-3 p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 accent-primary"
                      checked={chosen.has(entry.id)}
                      disabled={
                        selecting === 'add' && workflow?.documents.some((d) => d.id === entry.id)
                      }
                      onChange={(e) =>
                        setChosen((previous) => {
                          const next = new Set(previous)
                          if (e.target.checked) next.add(entry.id)
                          else next.delete(entry.id)
                          return next
                        })
                      }
                    />
                    <span>{entry.item.title}</span>
                  </label>
                ))}
              </div>
              {candidateOffset !== undefined ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void loadCandidates(candidateOffset)}
                >
                  {t('Load more')}
                </Button>
              ) : null}
              <div className="flex items-center gap-3">
                <Button
                  disabled={
                    busy ||
                    !chosen.size ||
                    chosen.size > 1000 ||
                    (selecting === 'create' && !name.trim())
                  }
                  onClick={async () => {
                    if (!reviewProjectId) return
                    const result = await mutate(
                      selecting === 'add' && workflow
                        ? {
                            action: 'add',
                            workflowId: workflow.id,
                            expectedUpdatedAt: workflow.updatedAt,
                            itemIds: [...chosen]
                          }
                        : {
                            action: 'create',
                            projectId: reviewProjectId,
                            name: name.trim(),
                            itemIds: [...chosen]
                          }
                    )
                    if (result?.workflow) {
                      setSelecting(undefined)
                      setStep(result.workflow.stage)
                    }
                  }}
                >
                  {selecting === 'add' ? t('Add selected') : t('Create task')}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t('Selected: {{total}}', { total: chosen.size })}
                </span>
                <Button variant="ghost" onClick={() => setSelecting(undefined)}>
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          </div>
        ) : !workflow ? (
          <div className="min-h-0 flex-1 overflow-auto p-6">
            <p className="mb-6 text-sm text-muted-foreground">
              {t('Keep review rules, decisions and evidence together in a dedicated task.')}
            </p>
            {!tasks.length ? (
              <div className="rounded-xl border border-border border-dashed p-12 text-center text-muted-foreground">
                <FileText className="mx-auto mb-4 size-8" />
                <p>{t('No screening tasks yet')}</p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => void openTask(task.id)}
                    className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold">{task.config.name}</h2>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {task.config.topic || t('Screening setup')}
                    </p>
                    <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                      <span>{t(STEPS[task.stage - 1])}</span>
                      <span>{t('References: {{total}}', { total: task.total })}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : step === 1 ? (
          <ScreeningSetup
            key={`${workflow.id}:${workflow.revision}`}
            workflow={workflow}
            disabled={disabled}
            mutate={mutate}
            onSaved={() => setStep(2)}
          />
        ) : step === 5 ? (
          <ScreeningExport
            workflow={workflow}
            projectName={reviewProjectName}
            disabled={disabled}
            mutate={mutate}
          />
        ) : (
          <>
            {step === 3 && unresolved > 0 ? (
              <p
                role="status"
                className="border-b border-border bg-muted/30 px-5 py-3 text-sm text-muted-foreground"
              >
                {t(
                  'Unresolved references: {{total}}. Continuing defers them; only included references are extracted. You can restore them later.',
                  { total: unresolved }
                )}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={disabled} onClick={() => execute()}>
                  <Play className="mr-2 size-4" />
                  {step === 2
                    ? t('Parse pending PDFs')
                    : step === 3
                      ? t('Run AI screening')
                      : t('Extract included references')}
                </Button>
                <Button variant="outline" disabled={disabled} onClick={() => execute(false, true)}>
                  <RefreshCw className="mr-2 size-4" />
                  {t('Retry failed')}
                </Button>
                {step === 4 ? (
                  <Button variant="outline" disabled={disabled} onClick={() => execute(true)}>
                    {t('Try a 10-paper sample')}
                  </Button>
                ) : null}
              </div>
              <Button variant="outline" disabled={disabled} onClick={() => void confirm()}>
                {step === 3 && unresolved > 0
                  ? t('Defer unresolved and continue')
                  : t('Confirm and continue')}
                <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
            <ScreeningReview
              key={`${workflow.id}:${step}`}
              workflow={workflow}
              step={step}
              disabled={disabled}
              mutate={mutate}
            />
          </>
        )}
        {busy ? (
          <div
            role="status"
            className="border-t border-border px-6 py-2 text-xs text-muted-foreground"
          >
            {t('Saving or loading…')}
          </div>
        ) : null}
      </div>
    </section>
  )
}
