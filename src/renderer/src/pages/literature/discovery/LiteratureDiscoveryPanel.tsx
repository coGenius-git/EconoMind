import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, LoaderCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { InlineNotice } from '@/components/ui/inline-notice'
import {
  DISCOVERY_DOCUMENT_TYPES,
  DISCOVERY_RESULT_LIMIT,
  OPENALEX_DISCOVERY_SOURCE_TIERS,
  type DiscoveryDocumentType,
  type DiscoverySourceId
} from '../../../../../shared/literature-discovery'
import { useLiteratureDiscovery } from './useLiteratureDiscovery'
import { LiteratureOpenAlexCredential } from '../detail/LiteratureOpenAlexCredential'

const DOCUMENT_TYPE_LABELS: Record<DiscoveryDocumentType, string> = {
  article: 'Journal article',
  review: 'Review',
  dissertation: 'Thesis',
  conference: 'Conference paper',
  book: 'Book',
  'book-chapter': 'Book chapter',
  preprint: 'Preprint',
  dataset: 'Dataset',
  report: 'Report',
  other: 'Other'
}
const SOURCE_TIER_LABELS = {
  doaj: 'Indexed in DOAJ',
  'open-access': 'Open access only'
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
  const [credentialBusy, setCredentialBusy] = useState(false)

  const runImport = async (): Promise<void> => {
    await discovery.importSelected(duplicatePolicy)
    onImported?.()
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 p-6">
      <header className="space-y-1">
        <h2 className="text-xl font-bold">{t('Search OpenAlex')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('Search by title, abstract or full text, then import selected records.')}
        </p>
      </header>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">{t('Search terms')}</span>
          <Textarea
            value={discovery.form.topic}
            rows={2}
            placeholder={t('Example: artificial intelligence AND firm performance')}
            onChange={(event) => discovery.update('topic', event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Publication year from')}</span>
          <Input
            value={discovery.form.yearFrom}
            type="number"
            min={1000}
            max={9999}
            inputMode="numeric"
            placeholder={t('Publication year from')}
            onChange={(event) => discovery.update('yearFrom', event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Publication year to')}</span>
          <Input
            value={discovery.form.yearTo}
            type="number"
            min={1000}
            max={9999}
            inputMode="numeric"
            placeholder={t('Publication year to')}
            onChange={(event) => discovery.update('yearTo', event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Minimum citations')}</span>
          <Input
            value={discovery.form.minCitations}
            type="number"
            min={0}
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
          <legend className="text-sm font-medium">{t('Access and indexing')}</legend>
          <div className="flex flex-wrap gap-3">
            {OPENALEX_DISCOVERY_SOURCE_TIERS.map((tier) => (
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

        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Language')}</span>
          <select
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={discovery.form.language}
            onChange={(event) =>
              discovery.update('language', event.target.value as '' | 'en' | 'zh')
            }
          >
            <option value="">{t('All languages')}</option>
            <option value="en">{t('English literature')}</option>
            <option value="zh">{t('Chinese literature')}</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">{t('Sort by')}</span>
          <select
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={discovery.form.sort}
            onChange={(event) =>
              discovery.update('sort', event.target.value as 'relevance' | 'newest' | 'citations')
            }
          >
            <option value="relevance">{t('Relevance')}</option>
            <option value="newest">{t('Newest first')}</option>
            <option value="citations">{t('Most cited')}</option>
          </select>
        </label>
        <div className="space-y-2 md:col-span-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(
              'Only records with a full-text link are shown. Downloads depend on availability at the source.'
            )}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('OpenAlex PDFs are downloaded when you import selected records.')}
          </p>
          <LiteratureOpenAlexCredential
            disabled={discovery.searching || discovery.importing}
            onSaved={() => void discovery.search()}
            onBusyChange={setCredentialBusy}
          />
        </div>

        <div className="md:col-span-2">
          <Button
            disabled={discovery.searching || credentialBusy}
            onClick={() => void discovery.search()}
          >
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
                        disabled={
                          !discovery.selected.has(candidate.key) &&
                          discovery.selected.size >= DISCOVERY_RESULT_LIMIT
                        }
                        onChange={() => discovery.toggleSelection(candidate.key)}
                      />
                    </td>
                    <td className="font-medium">
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">{candidate.title}</span>
                        {candidate.url ? (
                          // Opens the record on the source site (CNKI detail page or the DOI target)
                          // in the system browser, which is where the user's own access applies.
                          <a
                            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline"
                            href={candidate.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-3" aria-hidden="true" />
                            {t('Open source page')}
                          </a>
                        ) : null}
                      </div>
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
          {discovery.importResult.fullText?.length ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('PDFs downloaded')}
                {': '}
                {
                  discovery.importResult.fullText.filter((entry) => entry.status === 'downloaded')
                    .length
                }
                {' · '}
                {t('PDFs already available')}
                {': '}
                {
                  discovery.importResult.fullText.filter((entry) => entry.status === 'existing')
                    .length
                }
                {' · '}
                {t('PDFs not downloaded')}
                {': '}
                {
                  discovery.importResult.fullText.filter(
                    (entry) => entry.status === 'failed' || entry.status === 'not-found'
                  ).length
                }
              </p>
              {discovery.importResult.fullText.some(
                (entry) => entry.status === 'failed' || entry.status === 'not-found'
              ) ? (
                <InlineNotice tone="amber">
                  {t(
                    'Some PDFs could not be downloaded. Their records were saved. Select those records and import again to retry.'
                  )}
                  <ul className="mt-2 list-disc pl-5">
                    {discovery.importResult.fullText
                      .filter((entry) => entry.status === 'failed' || entry.status === 'not-found')
                      .slice(0, 10)
                      .map((entry) => (
                        <li key={entry.itemId}>
                          {
                            discovery.candidates.find((candidate) => candidate.key === entry.key)
                              ?.title
                          }
                          {entry.reason ? (
                            <span className="ml-2">
                              {entry.reason === 'access-required'
                                ? t(
                                    'Connect to an authorized institutional network or sign in in the browser, then import again.'
                                  )
                                : entry.reason === 'verification-required'
                                  ? t(
                                      'Complete CNKI verification in the browser, then import again.'
                                    )
                                  : entry.reason === 'pdf-unavailable'
                                    ? t('No valid PDF is available for this record.')
                                    : t('PDF download failed. Try again.')}
                            </span>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </InlineNotice>
              ) : null}
            </>
          ) : null}
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

          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(
              'Imported records live in your library: open one there to look for its open-access full text.'
            )}
          </p>

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
