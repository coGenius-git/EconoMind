import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Download, FileText, Plus, X } from 'lucide-react'
import { ScreeningPackagePreview } from './ScreeningPackagePreview'
import { ScreeningCriteriaInput } from './ScreeningCriteriaInput'
import { saveScreeningPackage } from './save-screening-package'
import { screeningErrorMessage } from './screening-error-message'
import { Button } from '@/components/ui/button'
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { normalizeCriteria, screeningConfigSchema } from '../../../../shared/literature-screening'
import type {
  ScreeningConfig,
  ScreeningDocument,
  ScreeningFinding,
  ScreeningRequest,
  ScreeningResponse,
  ScreeningWorkflow
} from '../../../../shared/literature-screening'

export type ScreeningMutate = (request: ScreeningRequest) => Promise<ScreeningResponse | undefined>
export const SCREENING_STATUS = {
  pending: 'Pending',
  running: 'Running',
  done: 'Completed',
  failed: 'Failed',
  stale: 'Needs rerun',
  included: 'Included',
  excluded: 'Excluded',
  uncertain: 'Uncertain'
} as const
const GROUPS = {
  concepts: 'Concepts',
  relations: 'Relationships',
  viewpoints: 'Viewpoints'
} as const
const readScreeningDraft = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}
const writeDraft = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Server saves remain authoritative. */
  }
}
const clearDraft = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Best effort local draft cleanup. */
  }
}
type FormProps = { workflow: ScreeningWorkflow; disabled: boolean; mutate: ScreeningMutate }
type Evidence = ScreeningDocument['evidence'][number]

export function ScreeningSetup({
  workflow,
  disabled,
  mutate,
  onSaved
}: FormProps & { onSaved: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const key = `screening-config:${workflow.id}:${workflow.revision}`
  const [draft, setDraft] = useState<ScreeningConfig>(() =>
    readScreeningDraft(key, workflow.config)
  )
  const fields = {
    name: 'Task name',
    topic: 'Review topic'
  } as const
  const update = (value: ScreeningConfig): void => {
    setDraft(value)
    writeDraft(key, value)
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(workflow.config)
  const normalizedConfig = {
    ...draft,
    ...(draft.inclusionRules ? { inclusionRules: normalizeCriteria(draft.inclusionRules) } : {}),
    ...(draft.exclusionRules ? { exclusionRules: normalizeCriteria(draft.exclusionRules) } : {}),
    ...Object.fromEntries(
      (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => [
        group,
        [...new Set(draft[group].map((value) => value.trim()).filter(Boolean))]
      ])
    )
  }
  const validConfig = screeningConfigSchema.safeParse(normalizedConfig).success
  return (
    <div className="min-h-0 flex-1 overflow-auto p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">{t('Define the scope of your screening')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('Save rules before processing. Changing rules marks downstream results for review.')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              'Task name, review topic and both criteria are required. Task name: up to 200 characters; other text fields: up to 10,000 characters each.'
            )}
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {Object.entries(fields).map(([field, label]) => (
            <label
              key={field}
              className={cn(
                'block space-y-2 text-sm font-medium',
                (field === 'name' || field === 'topic') && 'lg:col-span-2'
              )}
            >
              <span className="block text-lg font-bold">{t(label)}</span>
              <Textarea
                disabled={disabled}
                aria-label={t(label)}
                required
                maxLength={field === 'name' ? 200 : 10000}
                rows={field === 'name' ? 1 : 3}
                value={draft[field as keyof typeof fields]}
                onChange={(e) => update({ ...draft, [field]: e.target.value })}
              />
            </label>
          ))}
          {(['inclusion', 'exclusion'] as const).map((kind) => (
            <ScreeningCriteriaInput
              key={kind}
              kind={kind}
              value={
                draft[`${kind}Rules`] ?? {
                  mode: draft[kind].trim() ? 'custom' : kind === 'inclusion' ? 'all' : 'any',
                  items: draft[kind] ? [draft[kind]] : [],
                  notes: ''
                }
              }
              disabled={disabled}
              onChange={(rules, text) =>
                update({ ...draft, [kind]: text, [`${kind}Rules`]: rules })
              }
            />
          ))}
        </div>
        <div className="mt-7 rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold">{t('Extraction dimensions')}</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            {t(
              'One item per box. Use + to add another; commas, semicolons and line breaks within a box remain part of the same item.'
            )}{' '}
            {t(
              'If all dimensions are blank, main research findings will be extracted automatically.'
            )}
          </p>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            {t(
              'Up to 50 items per group and 300 characters per item. Empty items and exact duplicates are ignored when saving.'
            )}{' '}
            {t(
              'These dimensions guide extraction, not inclusion or exclusion. Put screening requirements in the criteria above. Viewpoints can contain multiple findings.'
            )}
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => (
              <DimensionInput
                key={group}
                label={t(GROUPS[group])}
                placeholder={
                  group === 'concepts'
                    ? t('e.g. Mandatory non-financial disclosure')
                    : group === 'relations'
                      ? t('e.g. Effect of mandatory disclosure on financing costs')
                      : t('e.g. Mechanisms affecting corporate behavior')
                }
                values={draft[group]}
                disabled={disabled}
                onChange={(values) => update({ ...draft, [group]: values })}
              />
            ))}
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <Button
            disabled={
              disabled ||
              !validConfig ||
              !draft.name.trim() ||
              !draft.topic.trim() ||
              !draft.inclusion.trim() ||
              !draft.exclusion.trim()
            }
            onClick={async () => {
              const result = await mutate({
                action: 'config',
                workflowId: workflow.id,
                expectedUpdatedAt: workflow.updatedAt,
                config: normalizedConfig
              })
              if (result) {
                clearDraft(key)
                onSaved()
              }
            }}
          >
            {t('Save and prepare full text')}
            <ChevronRight className="ml-2 size-4" />
          </Button>
          {dirty ? (
            <span className="text-xs text-muted-foreground">{t('Draft saved on this device')}</span>
          ) : null}
        </div>
        {!validConfig ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {t('Check the task name and the length and number limits above before saving.')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
function DimensionInput({
  label,
  placeholder,
  values,
  disabled,
  onChange
}: {
  label: string
  placeholder: string
  values: string[]
  disabled: boolean
  onChange: (values: string[]) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const id = useId()
  const items = values.length ? values : ['']
  return (
    <fieldset className="min-w-0 space-y-3 text-sm" disabled={disabled}>
      <legend className="mb-2 font-medium">{label}</legend>
      {items.map((value, index) => (
        <div key={index} className="flex items-start gap-1">
          <div className="relative min-w-0 flex-1">
            <label htmlFor={`${id}-${index}`} className="sr-only">
              {t('{{group}} item {{index}}', { group: label, index: index + 1 })}
            </label>
            <Textarea
              id={`${id}-${index}`}
              rows={2}
              maxLength={300}
              placeholder={placeholder}
              value={value}
              onChange={(e) =>
                onChange(items.map((item, i) => (i === index ? e.target.value : item)))
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('Remove {{group}} item {{index}}', { group: label, index: index + 1 })}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={disabled || items.length >= 50}
        onClick={() => onChange([...items, ''])}
      >
        <Plus className="mr-2 size-4" />
        {t('Add {{group}} item', { group: label })}
      </Button>
    </fieldset>
  )
}
export function ScreeningEvidence({
  evidence,
  jump,
  markdown
}: {
  evidence: Evidence[]
  jump: (e: Evidence) => void
  markdown: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="mt-3 space-y-2">
      {evidence.map((e, i) => (
        <button
          key={i}
          type="button"
          disabled={!e.matched}
          onClick={() => jump(e)}
          className="block w-full rounded-md border-l-2 border-primary/40 bg-background p-3 text-left text-xs leading-relaxed disabled:opacity-60"
        >
          <span className="block whitespace-pre-wrap">{e.quote}</span>
          <span className={cn('mt-2 block', e.matched ? 'text-primary' : 'text-destructive')}>
            {e.matched
              ? markdown
                ? t('Paragraph {{page}}', { page: e.page })
                : t('Page {{page}}', { page: e.page })
              : t('Evidence not matched')}
          </span>
        </button>
      ))}
    </div>
  )
}
export function ScreeningDecision({
  workflow,
  document: doc,
  disabled,
  mutate,
  preparation
}: FormProps & { document: ScreeningDocument; preparation: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const key = `screening-note:${workflow.id}:${doc.id}`
  const [note, setNote] = useState<string>(() => readScreeningDraft(key, doc.note))
  const save = async (
    decision?: ScreeningDocument['decision'],
    deferred?: boolean
  ): Promise<void> => {
    const result = await mutate({
      action: 'review',
      workflowId: workflow.id,
      expectedUpdatedAt: workflow.updatedAt,
      itemIds: [doc.id],
      decision,
      note,
      deferred
    })
    if (result) clearDraft(key)
  }
  return (
    <div className="shrink-0 space-y-2 border-t border-border bg-background p-4">
      <h3 className="font-semibold">{preparation ? t('Preparation notes') : t('Your decision')}</h3>
      {doc.decision && !preparation ? (
        <p className="text-sm text-primary">{t(SCREENING_STATUS[doc.decision])}</p>
      ) : null}
      <Textarea
        aria-label={t('Review notes')}
        placeholder={t('Review notes')}
        value={note}
        disabled={disabled}
        onChange={(e) => {
          setNote(e.target.value)
          writeDraft(key, e.target.value)
        }}
      />
      {!preparation ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={disabled} onClick={() => void save('included', false)}>
            {t('Include')}
          </Button>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => void save('excluded', false)}
          >
            {t('Exclude')}
          </Button>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => void save('uncertain', false)}
          >
            {t('Uncertain')}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" disabled={disabled} onClick={() => void save()}>
          {t('Save notes')}
        </Button>
        <Button
          variant="ghost"
          disabled={disabled}
          onClick={() => void save(undefined, !doc.deferred)}
        >
          {doc.deferred ? t('Restore to queue') : t('Defer this reference')}
        </Button>
      </div>
    </div>
  )
}
export function ScreeningFindings({
  workflow,
  document: doc,
  disabled,
  mutate,
  jump
}: FormProps & { document: ScreeningDocument; jump: (e: Evidence) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const key = `screening-findings:${workflow.id}:${doc.id}:${workflow.revision}:${doc.editedAt ?? 0}`
  const [findings, setFindings] = useState<ScreeningFinding[]>(() =>
    readScreeningDraft(key, doc.findings)
  )
  const [sample, setSample] = useState(false)
  const update = (next: ScreeningFinding[]): void => {
    setFindings(next)
    writeDraft(key, next)
  }
  const shown = sample ? (doc.sampleFindings ?? []) : findings
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('Extracted findings')}</h3>
        {doc.sampleFindings ? (
          <Button size="sm" variant="outline" onClick={() => setSample(!sample)}>
            {sample ? t('Formal results') : t('Sample results only')}
          </Button>
        ) : null}
      </div>
      {!shown.length ? (
        <p className="text-sm text-muted-foreground">{t('No extraction results yet')}</p>
      ) : (
        shown.map((finding, i) => (
          <section
            key={`${finding.group}:${finding.dimension}`}
            className="rounded-lg border border-border p-4"
          >
            <p className="text-xs text-muted-foreground">{t(GROUPS[finding.group])}</p>
            <h4 className="mt-1 font-medium">{finding.dimension}</h4>
            {!finding.hasContent ? (
              <p className="mt-3 text-sm text-muted-foreground">{t('No relevant content found')}</p>
            ) : (
              finding.points.map((point, j) => (
                <div key={j} className="mt-4">
                  <Textarea
                    aria-label={t('Finding summary')}
                    value={point.summary}
                    disabled={disabled || sample || doc.extractionStatus !== 'done'}
                    onChange={(e) =>
                      update(
                        findings.map((f, index) =>
                          index === i
                            ? {
                                ...f,
                                points: f.points.map((p, n) =>
                                  n === j ? { ...p, summary: e.target.value } : p
                                )
                              }
                            : f
                        )
                      )
                    }
                  />
                  <ScreeningEvidence
                    evidence={point.evidence}
                    jump={jump}
                    markdown={doc.sourceKind === 'markdown'}
                  />
                </div>
              ))
            )}
          </section>
        ))
      )}
      {!sample && doc.extractionStatus === 'done' ? (
        <Button
          variant="outline"
          disabled={disabled}
          onClick={async () => {
            const result = await mutate({
              action: 'findings',
              workflowId: workflow.id,
              expectedUpdatedAt: workflow.updatedAt,
              itemId: doc.id,
              findings
            })
            if (result) clearDraft(key)
          }}
        >
          {t('Save findings')}
        </Button>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(
          'Only included references enter formal extraction. Sample results do not replace formal results.'
        )}
      </p>
    </div>
  )
}
export function ScreeningExport({
  workflow,
  projectName,
  disabled,
  mutate
}: FormProps & { projectName?: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [partial, setPartial] = useState(false)
  const [screeningOnly, setScreeningOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [confirmPartialOpen, setConfirmPartialOpen] = useState(false)
  const [prepared, setPrepared] = useState<{
    key: string
    data: NonNullable<ScreeningResponse['export']>
  }>()
  const exportKey = `${workflow.id}:${workflow.updatedAt}:${partial}:${screeningOnly}`
  const packageData = prepared?.key === exportKey ? prepared.data : undefined
  const dimensions = [
    ...workflow.config.concepts,
    ...workflow.config.relations,
    ...workflow.config.viewpoints
  ]
  const incomplete = workflow.documents.filter(
    (d) =>
      d.deferred ||
      !d.decision ||
      d.decision === 'uncertain' ||
      (!screeningOnly && d.decision === 'included' && d.extractionStatus !== 'done')
  )
  const requiresPartial = incomplete.length > 0 || (!screeningOnly && !workflow.extractionConfirmed)
  const preparePackage = async (
    preview: boolean,
    allowPartial = partial
  ): Promise<ScreeningResponse['export']> => {
    // Downloads always revalidate server-side, including after a cached preview.
    if (preview && packageData) return packageData
    const result = await mutate({
      action: 'export',
      preview,
      workflowId: workflow.id,
      expectedUpdatedAt: workflow.updatedAt,
      partial: allowPartial,
      screeningOnly
    })
    if (result?.export) setPrepared({ key: exportKey, data: result.export })
    return result?.export
  }
  const download = async (preview = false, allowPartial = partial): Promise<void> => {
    setSaving(true)
    setExportStatus('')
    try {
      if (!preview && !allowPartial && requiresPartial) {
        setConfirmPartialOpen(true)
        return
      }
      if (preview) {
        if (await preparePackage(true)) setPreviewOpen(true)
        return
      }
      const saved = await saveScreeningPackage(projectName ?? workflow.config.name, () =>
        preparePackage(false, allowPartial)
      )
      if (saved.saved)
        setExportStatus(
          saved.filePath ? t('Saved to: {{path}}', { path: saved.filePath }) : t('Export complete')
        )
    } catch (error) {
      setExportStatus(
        screeningErrorMessage(error instanceof Error ? error.message : String(error), t)
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-xl font-semibold">{t('Screening evidence package')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('Download Word reports and an audit record together as a ZIP file.')}
        </p>
        <div className="my-6 grid grid-cols-3 divide-x rounded-xl border border-border bg-card p-5">
          {(['included', 'excluded', 'uncertain'] as const).map((status) => (
            <div key={status} className="px-4">
              <p className="text-sm text-muted-foreground">{t(SCREENING_STATUS[status])}</p>
              <p className="mt-2 text-3xl font-semibold">
                {
                  workflow.documents.filter((d) =>
                    status === 'uncertain'
                      ? !d.decision || d.decision === 'uncertain'
                      : d.decision === status
                  ).length
                }
              </p>
            </div>
          ))}
        </div>
        {requiresPartial ? (
          <section
            role="status"
            className="mb-6 rounded-xl border border-border bg-muted/30 p-4 text-sm"
          >
            <p>
              {t(
                'Some results are unfinished. Preview them now, or enable partial export before downloading.'
              )}
            </p>
            {incomplete.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {incomplete.map((d) => (
                  <li key={d.id}>
                    {d.title} —{' '}
                    {d.deferred
                      ? t('Deferred')
                      : !d.decision || d.decision === 'uncertain'
                        ? t('Uncertain')
                        : t(SCREENING_STATUS[d.extractionStatus])}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
        <div className="space-y-3 rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold">{t('Export contents')}</h3>
          <p className="text-sm">
            {t('Screening report with AI suggestions, manual decisions and evidence')}
          </p>
          {!screeningOnly
            ? dimensions.map((dimension, i) => (
                <p key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="size-4" />
                  {dimension}
                </p>
              ))
            : null}
          <p className="text-sm text-muted-foreground">
            {t('JSON audit record with configuration and history')}
          </p>
        </div>
        <div className="my-6 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled || saving}
              checked={screeningOnly}
              onChange={(e) => setScreeningOnly(e.target.checked)}
            />
            {t('Export screening report only')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled || saving}
              checked={partial}
              onChange={(e) => setPartial(e.target.checked)}
            />
            {t('Allow partial export and list incomplete references')}
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={disabled || saving}
            onClick={() => void download(true)}
          >
            {t('Preview evidence package')}
          </Button>
          <Button disabled={disabled || saving} onClick={() => void download()}>
            <Download className="mr-2 size-4" />
            {t('Save evidence package as…')}
          </Button>
        </div>
        {previewOpen && packageData ? (
          <ScreeningPackagePreview key={exportKey} data={packageData} />
        ) : null}
        {exportStatus ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {exportStatus}
          </p>
        ) : null}
        <ConfirmActionDialog
          open={confirmPartialOpen}
          title={t('Export available results?')}
          description={t(
            'Some references are unfinished or deferred. Continue to choose a save location for the available results. The evidence package will list all incomplete references.'
          )}
          cancelLabel={t('Cancel')}
          confirmLabel={t('Continue to Save As')}
          onCancel={() => setConfirmPartialOpen(false)}
          onConfirm={() => {
            setConfirmPartialOpen(false)
            setPartial(true)
            void download(false, true)
          }}
        />
      </div>
    </div>
  )
}
