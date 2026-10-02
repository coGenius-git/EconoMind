import { BookOpenText, ExternalLink, FileText, MoreHorizontal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ResourceTagSummary } from '../settings/ResourceTagControls'
import type { LiteratureItemView } from '../../../../shared/literature'
import { fullCreatorLabel, publicationSummary } from './literature-presentation'

type Props = {
  entry: LiteratureItemView
  busy: boolean
  onClose: () => void
  onDetails: () => void
  onPreview: () => void
  onRead: () => void
}

// Uses the current catalog result; metadata editing stays in the existing detail dialog.
export function LiteratureReadingPane({
  entry,
  busy,
  onClose,
  onDetails,
  onPreview,
  onRead
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  const attachment = entry.attachments.find((item) => item.versions[0])?.versions[0]
  const canRead = Boolean(attachment && attachment.availability !== 'unavailable' && !busy)
  return (
    <aside
      aria-label={t('Reference details')}
      data-slot="literature-reading-pane"
      className="hidden min-h-0 w-[34%] min-w-80 max-w-[480px] shrink-0 overflow-y-auto border-l border-border bg-background px-6 py-7 xl:block"
    >
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('Reference details')}</h2>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('Edit metadata')}
            onClick={onDetails}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('Close details')}
            onClick={onClose}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <h3 className="break-words text-xl font-semibold leading-relaxed tracking-tight">
        {entry.item.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{fullCreatorLabel(entry.item)}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {[entry.item.issuedYear, entry.item.containerTitle, entry.item.language]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className="my-7 flex flex-wrap gap-2">
        <Button type="button" className="min-h-10 flex-1" disabled={!canRead} onClick={onRead}>
          <BookOpenText className="size-4" aria-hidden="true" />
          {t('Read with agent')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          disabled={!canRead}
          onClick={onPreview}
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          {t('Open PDF')}
        </Button>
      </div>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">{t('Abstract')}</h4>
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
          {entry.item.abstract || t('No abstract available.')}
        </p>
      </section>
      <div className="py-6">
        <ResourceTagSummary reference={{ resourceType: 'literature.item', resourceId: entry.id }} />
      </div>
      <section className="border-t border-border py-5">
        <h4 className="mb-3 text-sm font-semibold">{t('Publication')}</h4>
        <p className="break-words text-sm leading-6 text-muted-foreground">
          {publicationSummary(entry.item) || '—'}
        </p>
        <Button type="button" variant="link" className="mt-2 h-auto px-0" onClick={onDetails}>
          {t('View details')}
        </Button>
      </section>
      <section className="border-t border-border py-5">
        <h4 className="mb-3 text-sm font-semibold">{t('Attachment')}</h4>
        {attachment ? (
          <button
            type="button"
            disabled={!canRead}
            onClick={onPreview}
            className="flex w-full items-center gap-3 rounded-md py-2 text-left text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <FileText className="size-6 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 break-all">{attachment.filename}</span>
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('Without PDF')}</p>
        )}
      </section>
    </aside>
  )
}
