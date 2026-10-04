import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoaderCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { InlineNotice } from '@/components/ui/inline-notice'
import {
  DISCOVERY_DOCUMENT_TYPES,
  DISCOVERY_RESULT_LIMIT,
  DISCOVERY_SEARCH_SOURCE_IDS,
  DISCOVERY_SOURCE_TIERS,
  type DiscoveryDocumentType,
  type DiscoverySourceId,
  type DiscoverySourceTier
} from '../../../../../shared/literature-discovery'
import { useLiteratureDiscovery } from './useLiteratureDiscovery'

const DOCUMENT_TYPE_LABELS: Record<DiscoveryDocumentType, string> = {
  article: 'Journal article',
  review: 'Review',
  dissertation: 'Thesis',
  conference: 'Conference paper',
  book: 'Book',
  other: 'Other'
}
const SOURCE_TIER_LABELS: Record<DiscoverySourceTier, string> = {
  cssci: 'CSSCI',
  pkucore: 'Peking University core',
  sci: 'SCI',
  ssci: 'SSCI',
  ei: 'EI',
  doaj: 'DOAJ',
  'open-access': 'Open access'
}
const SOURCE_LABELS: Record<DiscoverySourceId, string> = {
  openalex: 'OpenAlex',
  cnki: 'CNKI'
}

export function LiteratureDiscoveryPanel({
  collectionId,
  onImported
}: {
  collectionId?: string
  onImported?: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const discovery = useLiteratureDiscovery(collectionId)
  const [criteriaText, setCriteriaText] = useState('')
  const [duplicatePolicy, setDuplicatePolicy] = useState<'reuse' | 'separate'>('reuse')

  const runImport = async (): Promise<void> => {
    await discovery.importSelected(duplicatePolicy)
    onImported?.()
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 p-6">
      <header className="space-y-1">
        <h2 className="text-xl font-bold">{t('Search external sources')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('Find records by topic and criteria, then import the ones you want to screen.')}
        </p>
      </header>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">{t('Review topic')}</span>
          <Textarea
            value={discovery.form.topic}
            rows={2}
            placeholder={t('Review topic')}
            onChange={(event) => discovery.update('topic', event.target.value)}
          />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">{t('Keywords')}</span>
          <Input
            value={discovery.form.keywords}
            placeholder={t('Keywords')}
            onChange={(event) => discovery.update('keywords', event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Publication year from')}</span>
          <Input
            value={discovery.form.yearFrom}
            inputMode="numeric"
            placeholder={t('Publication year from')}
            onChange={(event) => discovery.update('yearFrom', event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Publication year to')}</span>
          <Input
            value={discovery.form.yearTo}
            inputMode="numeric"
            placeholder={t('Publication year to')}
            onChange={(event) => discovery.update('yearTo', event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Minimum citations')}</span>
          <Input
            value={discovery.form.minCitations}
            inputMode="numeric"
            placeholder={t('Minimum citations')}
            onChange={(event) => discovery.update('minCitations', event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Maximum records')}</span>
          <Input
            type="number"
            min={1}
            max={DISCOVERY_RESULT_LIMIT}
            value={String(discovery.form.limit)}
            onChange={(event) => discovery.update('limit', Number(event.target.value))}
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('Document types')}</legend>
          <div className="flex flex-wrap gap-3">
            {DISCOVERY_DOCUMENT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={discovery.form.documentTypes.includes(type)}
                  onChange={() => discovery.toggleDocumentType(type)}
                />
                <span>{t(DOCUMENT_TYPE_LABELS[type])}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('Source tiers')}</legend>
          <div className="flex flex-wrap gap-3">
            {DISCOVERY_SOURCE_TIERS.map((tier) => (
              <label key={tier} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={discovery.form.sourceTiers.includes(tier)}
                  onChange={() => discovery.toggleSourceTier(tier)}
                />
                <span>{t(SOURCE_TIER_LABELS[tier])}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3 md:col-span-2">
          <legend className="text-sm font-medium">{t('Data sources')}</legend>
          <div className="flex flex-wrap items-center gap-4">
            {DISCOVERY_SEARCH_SOURCE_IDS.map((source) => (
              <label key={source} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={discovery.form.sources.includes(source)}
                  onChange={() => discovery.toggleSource(source)}
                />
                <span>{t(SOURCE_LABELS[source])}</span>
              </label>
            ))}
            <span className="text-xs text-muted-foreground">{t('Searched online')}</span>
          </div>
          {discovery.form.sources.includes('cnki') ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={discovery.cnkiSignedIn ? 'default' : 'secondary'}>
                {discovery.cnkiSignedIn ? t('CNKI session ready') : t('No CNKI session')}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={discovery.signingIn}
                onClick={() => void discovery.signInCnki()}
              >
                {discovery.signingIn ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {t('Sign in to CNKI')}
              </Button>
            </div>
          ) : null}
          {discovery.form.sources.includes('cnki') && !discovery.cnkiSignedIn ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('Sign in to CNKI before searching.')}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span>{t('Import a CNKI export file')}</span>
              <input
                type="file"
                accept=".txt,.ris,.enw,.nbib,.bib,text/plain"
                disabled={discovery.parsing}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  // Reset so the same file can be picked again after an edit.
                  event.target.value = ''
                  if (file) void discovery.importCnkiExport(file)
                }}
              />
            </label>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(
              'Export the selected references as RefWorks or EndNote from CNKI, then import that file here.'
            )}
          </p>
        </fieldset>

        <div className="md:col-span-2">
          <Button disabled={discovery.searching} onClick={() => void discovery.search()}>
            {discovery.searching ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            {discovery.searching ? t('Searching') : t('Search')}
          </Button>
        </div>
      </section>

      {discovery.error ? (
        <InlineNotice tone="red" role="alert">
          {t('Search failed')}
          {': '}
          {discovery.error}
        </InlineNotice>
      ) : null}
      {discovery.notice ? <InlineNotice tone="teal">{discovery.notice}</InlineNotice> : null}
      {discovery.warnings.length ? (
        <InlineNotice tone="amber">
          {t('Warnings')}
          {': '}
          {discovery.warnings.join(' ')}
        </InlineNotice>
      ) : null}

      {discovery.candidates.length ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-bold">{t('Records')}</h3>
            <span className="text-sm text-muted-foreground">
              {String(discovery.candidates.length)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => discovery.selectAll(true)}>
              {t('Select all')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => discovery.selectAll(false)}>
              {t('Clear selection')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('Selected')}
              {': '}
              {String(discovery.selected.size)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="w-8" />
                  <th>{t('Title')}</th>
                  <th>{t('Authors')}</th>
                  <th>{t('Year')}</th>
                  <th>{t('Venue')}</th>
                  <th>{t('Citations')}</th>
                  <th>{t('Source')}</th>
                </tr>
              </thead>
              <tbody>
                {discovery.candidates.map((candidate) => (
                  <tr key={candidate.key} className="border-t border-border align-top">
                    <td>
                      <input
                        type="checkbox"
                        aria-label={candidate.title}
                        checked={discovery.selected.has(candidate.key)}
                        onChange={() => discovery.toggleSelection(candidate.key)}
                      />
                    </td>
                    <td className="font-medium">
                      {candidate.url ? (
                        <a
                          className="underline"
                          href={candidate.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {candidate.title}
                        </a>
                      ) : (
                        candidate.title
                      )}
                    </td>
                    <td>{candidate.authors.slice(0, 4).join(', ')}</td>
                    <td>{candidate.year === null ? '' : String(candidate.year)}</td>
                    <td>{candidate.venue}</td>
                    <td>
                      {candidate.citationCount === null ? '' : String(candidate.citationCount)}
                    </td>
                    <td>{t(SOURCE_LABELS[candidate.source])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {discovery.candidates.length ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{t('Duplicate policy')}</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="discovery-duplicate-policy"
                checked={duplicatePolicy === 'reuse'}
                onChange={() => setDuplicatePolicy('reuse')}
              />
              <span>{t('Reuse existing records')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="discovery-duplicate-policy"
                checked={duplicatePolicy === 'separate'}
                onChange={() => setDuplicatePolicy('separate')}
              />
              <span>{t('Create separate records')}</span>
            </label>
            <Button
              disabled={discovery.importing || discovery.selected.size === 0}
              onClick={() => void runImport()}
            >
              {discovery.importing ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {discovery.importing ? t('Importing') : t('Import selected')}
            </Button>
          </div>
        </section>
      ) : null}

      {discovery.importResult?.importedCount ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h3 className="text-base font-bold">{t('Screen imported records')}</h3>
          <label className="block space-y-2">
            <span className="text-sm font-medium">{t('Inclusion criteria')}</span>
            <Textarea
              value={criteriaText}
              rows={4}
              placeholder={t('One criterion per line')}
              onChange={(event) => setCriteriaText(event.target.value)}
            />
          </label>
          <Button
            disabled={discovery.screening}
            onClick={() =>
              void discovery.screenImported({
                mode: 'all',
                items: criteriaText.split('\n'),
                notes: ''
              })
            }
          >
            {discovery.screening ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {discovery.screening ? t('Screening') : t('Screen imported records')}
          </Button>

          {discovery.screenResult ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('Included')}
                {': '}
                {String(discovery.screenResult.includeCount)}
                {' · '}
                {t('Excluded')}
                {': '}
                {String(discovery.screenResult.excludeCount)}
                {' · '}
                {t('Undecided')}
                {': '}
                {String(discovery.screenResult.undecidedCount)}
              </p>
              <ul className="space-y-2">
                {discovery.screenResult.outcomes.map((outcome) => (
                  <li key={outcome.itemId} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={outcome.decision === 'include' ? 'default' : 'secondary'}>
                        {outcome.decision === 'include'
                          ? t('Included')
                          : outcome.decision === 'exclude'
                            ? t('Excluded')
                            : t('Undecided')}
                      </Badge>
                      {outcome.failed ? <Badge variant="destructive">{t('Failed')}</Badge> : null}
                    </div>
                    <p className="mt-1 text-muted-foreground">{outcome.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default LiteratureDiscoveryPanel
