import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { cn } from '@/lib/utils'
import { createLiteratureAttachmentVersionReference } from '../../../../shared/literature'
import type {
  ScreeningDocument,
  ScreeningTextPage,
  ScreeningWorkflow
} from '../../../../shared/literature-screening'
import { PdfPreviewContent } from '../workspace/previews/renderers/PdfPreview'
import { screeningErrorMessage } from './screening-error-message'
import {
  ScreeningDecision,
  ScreeningEvidence,
  ScreeningFindings,
  SCREENING_STATUS,
  type ScreeningMutate
} from './ScreeningForms'

export function ScreeningReview({
  workflow,
  step,
  disabled,
  mutate
}: {
  workflow: ScreeningWorkflow
  step: number
  disabled: boolean
  mutate: ScreeningMutate
}): React.JSX.Element {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState<{ key: string; pages: ScreeningTextPage[] }>()
  const [error, setError] = useState('')
  const [view, setView] = useState<'pdf' | 'text'>('pdf')
  const [expanded, setExpanded] = useState(false)
  const [reveal, setReveal] = useState<{ pageNumber: number; query?: string; nonce: number }>()
  const positions = useRef<Record<string, number>>({})
  const markdownInput = useRef<HTMLInputElement>(null)
  const stageKey = step === 2 ? 'parseStatus' : step === 3 ? 'screeningStatus' : 'extractionStatus'
  const docs = workflow.documents.filter((d) => step !== 4 || d.decision === 'included')
  const current = docs.find((d) => d.id === selectedId) ?? docs[0]
  const currentId = current?.id
  const textKey = `${currentId}:${current?.checksum}:${current?.parseStatus}`
  const pages = loaded?.key === textKey ? loaded.pages : []
  const visibleDocs = docs.filter(
    (d) =>
      (!query || d.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
      (filter === 'all' ||
        (filter === 'unreviewed'
          ? !d.decision || d.decision === 'uncertain'
          : filter === 'deferred'
            ? d.deferred
            : d[stageKey] === filter || d.decision === filter))
  )
  useEffect(() => {
    let cancelled = false
    if (currentId)
      void window.api.literature
        .screening({ action: 'document', workflowId: workflow.id, itemId: currentId })
        .then((r) => {
          if (!cancelled) {
            setLoaded({ key: textKey, pages: r.pages ?? [] })
            setError('')
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        })
    return () => {
      cancelled = true
    }
  }, [workflow.id, currentId, textKey])
  const selectDocument = (doc: ScreeningDocument): void => {
    setSelectedId(doc.id)
    setReveal((previous) => ({
      pageNumber: positions.current[doc.id] ?? 1,
      nonce: (previous?.nonce ?? 0) + 1
    }))
  }
  const jump = (evidence: ScreeningDocument['evidence'][number]): void => {
    if (!evidence.matched || !evidence.page) return
    if (current?.sourceKind === 'markdown' || view === 'text' || !current?.attachmentVersionId) {
      setView('text')
      requestAnimationFrame(() =>
        document
          .getElementById(`screening-text-${evidence.page}`)
          ?.scrollIntoView({ block: 'center' })
      )
    } else {
      setView('pdf')
      setReveal((previous) => ({
        pageNumber: evidence.page!,
        query: evidence.quote,
        nonce: (previous?.nonce ?? 0) + 1
      }))
    }
  }
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {!expanded ? (
        <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-muted/10 xl:w-60">
          <div className="space-y-2 border-b border-border p-3">
            <Input
              aria-label={t('Search references')}
              placeholder={t('Search references')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="w-full rounded-md border border-border bg-background p-2 text-xs"
              aria-label={t('Filter references')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{t('All references')}</option>
              <option value="unreviewed">{t('Awaiting review')}</option>
              <option value="included">{t('Included')}</option>
              <option value="excluded">{t('Excluded')}</option>
              <option value="failed">{t('Failed')}</option>
              <option value="deferred">{t('Deferred')}</option>
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleDocs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => selectDocument(doc)}
                className={cn(
                  'w-full border-b border-border border-border/50 p-4 text-left',
                  current?.id === doc.id
                    ? 'border-l-2 border-l-primary bg-primary/10'
                    : 'hover:bg-muted'
                )}
              >
                <p className="line-clamp-3 text-sm font-medium leading-relaxed">{doc.title}</p>
                <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
                  <span>{doc.year ?? '—'}</span>
                  <span className={doc[stageKey] === 'failed' ? 'text-destructive' : ''}>
                    {doc.deferred
                      ? t('Deferred')
                      : step === 3 && !doc.decision && doc.screeningStatus === 'done'
                        ? t('Awaiting review')
                        : t(
                            SCREENING_STATUS[
                              step === 3 && doc.decision ? doc.decision : doc[stageKey]
                            ]
                          )}
                  </span>
                </div>
              </button>
            ))}
            {!visibleDocs.length ? (
              <p className="p-4 text-sm text-muted-foreground">{t('No matching references')}</p>
            ) : null}
          </div>
          {step === 3 ? (
            <Button
              variant="ghost"
              className="m-2 h-auto whitespace-normal"
              disabled={disabled || !visibleDocs.length}
              onClick={() =>
                void mutate({
                  action: 'review',
                  workflowId: workflow.id,
                  expectedUpdatedAt: workflow.updatedAt,
                  itemIds: visibleDocs.map((d) => d.id),
                  acceptSuggestions: true
                })
              }
            >
              {t('Accept suggestions in this list')}
            </Button>
          ) : null}
        </aside>
      ) : null}
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="65%" minSize="35%">
          <div className="flex h-full min-w-0 flex-col bg-muted/20">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={view === 'pdf' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    if (current) selectDocument(current)
                    setView('pdf')
                  }}
                >
                  {t('PDF preview')}
                </Button>
                <Button
                  size="sm"
                  variant={view === 'text' ? 'secondary' : 'ghost'}
                  onClick={() => setView('text')}
                >
                  {t('Prepared text')}
                </Button>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={expanded ? t('Restore layout') : t('Expand PDF')}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {view === 'pdf' && current?.attachmentVersionId ? (
                <PdfPreviewContent
                  key={current.attachmentVersionId}
                  source="literature"
                  path={createLiteratureAttachmentVersionReference(current.attachmentVersionId)}
                  name={current.filename ?? current.title}
                  revealRequest={reveal}
                  onReadingPositionChange={(position) => {
                    positions.current[current.id] = position.pageNumber
                  }}
                />
              ) : (
                <div className="h-full overflow-y-auto p-6">
                  {error ? (
                    <p role="alert" className="text-destructive">
                      {error}
                    </p>
                  ) : null}
                  {view === 'pdf' ? (
                    <p className="mb-4 text-sm text-muted-foreground">
                      {t('No PDF attached. Prepared text is shown below.')}
                    </p>
                  ) : null}
                  {!pages.length ? (
                    <p className="text-sm text-muted-foreground">
                      {t('Parse a PDF or import Markdown to prepare full text.')}
                    </p>
                  ) : (
                    pages.map((page) => (
                      <section
                        key={page.page}
                        id={`screening-text-${page.page}`}
                        className="mb-5 rounded-lg border border-border bg-card p-5"
                      >
                        <div className="mb-3 text-xs font-medium text-primary">
                          {current?.sourceKind === 'markdown'
                            ? t('Paragraph {{page}}', { page: page.page })
                            : t('Page {{page}}', { page: page.page })}
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-7">
                          {page.text || t('No text on this page')}
                        </p>
                      </section>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
        {!expanded ? (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="35%" minSize="25%">
              <div className="flex h-full min-h-0 flex-col bg-background">
                {current ? (
                  <>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      <h2 className="text-base font-semibold leading-relaxed">{current.title}</h2>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[current.authors, current.year, current.doi].filter(Boolean).join(' · ')}
                      </p>
                      {current.error ? (
                        <p
                          role="alert"
                          className="mt-4 rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
                        >
                          {screeningErrorMessage(current.error, t)}
                        </p>
                      ) : null}
                      {step === 2 ? (
                        <div className="mt-6 space-y-4">
                          <h3 className="font-medium">{t('Full-text preparation')}</h3>
                          <Button
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              void mutate({
                                action: 'refreshSource',
                                workflowId: workflow.id,
                                expectedUpdatedAt: workflow.updatedAt,
                                itemId: current.id
                              })
                            }
                          >
                            {t('Refresh PDF attachment')}
                          </Button>
                          <p className="text-sm text-muted-foreground">
                            {t('Readable pages: {{readable}} / {{total}}', {
                              readable: current.parsedPages,
                              total: current.pageCount
                            })}
                          </p>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {t(
                              'Local PDF parsing is included. Scanned documents can use imported Markdown.'
                            )}
                          </p>
                          <Button
                            variant="outline"
                            disabled={disabled}
                            onClick={() => markdownInput.current?.click()}
                          >
                            {t('Import Markdown')}
                          </Button>
                          <input
                            ref={markdownInput}
                            type="file"
                            accept=".md,.markdown,.txt"
                            className="hidden"
                            aria-label={t('Import Markdown')}
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              e.target.value = ''
                              if (!file) return
                              if (file.size > 5_000_000) {
                                setError(t('Markdown must be smaller than 5 MB.'))
                                return
                              }
                              try {
                                await mutate({
                                  action: 'markdown',
                                  workflowId: workflow.id,
                                  expectedUpdatedAt: workflow.updatedAt,
                                  itemId: current.id,
                                  filename: file.name,
                                  text: await file.text()
                                })
                              } catch (e) {
                                setError(e instanceof Error ? e.message : String(e))
                              }
                            }}
                          />
                          {error ? (
                            <p role="alert" className="text-sm text-destructive">
                              {error}
                            </p>
                          ) : null}
                        </div>
                      ) : step === 3 ? (
                        <div className="mt-6 space-y-4">
                          <div className="rounded-lg border border-border bg-muted/20 p-4">
                            <h3 className="text-sm font-medium">{t('AI suggestion')}</h3>
                            <p className="mt-2 font-semibold text-primary">
                              {current.screeningStatus === 'done' && current.suggestion
                                ? t(SCREENING_STATUS[current.suggestion])
                                : t(SCREENING_STATUS[current.screeningStatus])}
                            </p>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                              {current.screeningStatus === 'done'
                                ? current.reason
                                : t('No AI suggestion yet')}
                            </p>
                            <ScreeningEvidence
                              evidence={current.screeningStatus === 'done' ? current.evidence : []}
                              jump={jump}
                              markdown={current.sourceKind === 'markdown'}
                            />
                          </div>
                        </div>
                      ) : (
                        <ScreeningFindings
                          key={`${workflow.id}:${current.id}:${current.editedAt ?? 0}:${current.extractionStatus}`}
                          workflow={workflow}
                          document={current}
                          disabled={disabled}
                          mutate={mutate}
                          jump={jump}
                        />
                      )}
                    </div>
                    {step !== 4 ? (
                      <ScreeningDecision
                        key={`${workflow.id}:${current.id}`}
                        workflow={workflow}
                        document={current}
                        disabled={disabled}
                        mutate={mutate}
                        preparation={step === 2}
                      />
                    ) : (
                      <Button
                        className="mt-4"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() =>
                          void mutate({
                            action: 'review',
                            workflowId: workflow.id,
                            expectedUpdatedAt: workflow.updatedAt,
                            itemIds: [current.id],
                            deferred: !current.deferred
                          })
                        }
                      >
                        {current.deferred ? t('Restore to queue') : t('Defer this reference')}
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  )
}
