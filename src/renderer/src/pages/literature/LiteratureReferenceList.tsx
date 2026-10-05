import type { ReactNode } from 'react'
import { FileText, MoreHorizontal, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ResourceTagBadges } from '../settings/ResourceTagControls'
import type { LiteratureItemView } from '../../../../shared/literature'
import { creatorLabel } from './literature-presentation'

type Props = {
  items: LiteratureItemView[]
  selectedId?: string
  onSelect: (entry: LiteratureItemView, trigger: HTMLButtonElement) => void
  onDetails: (entry: LiteratureItemView, trigger: HTMLButtonElement) => void
  renderCheckbox: (entry: LiteratureItemView) => ReactNode
  selectPage: ReactNode
}

export function LiteratureReferenceList({
  items,
  selectedId,
  onSelect,
  onDetails,
  renderCheckbox,
  selectPage
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      className="research-library-reference-list research-reading-surface min-h-0 flex-1 overflow-y-auto"
      data-slot="literature-reference-list"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 text-xs text-muted-foreground">
        {selectPage}
        <span>{t('Select all references')}</span>
      </div>
      <ul className="divide-y divide-border/70">
        {items.map((entry) => {
          const hasPdf = entry.attachments.some(
            (attachment) =>
              attachment.versions[0]?.availability !== 'unavailable' && attachment.versions[0]
          )
          return (
            <li
              key={entry.id}
              className={cn(
                'group relative grid grid-cols-[1rem_minmax(0,1fr)_2rem] items-start gap-3 border-l-2 border-transparent px-4 py-5 transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/50',
                entry.id === selectedId && 'border-primary bg-primary/7'
              )}
            >
              <div className="relative z-10 pt-1">{renderCheckbox(entry)}</div>
              <div className="min-w-0">
                <button
                  type="button"
                  aria-pressed={entry.id === selectedId}
                  onClick={(event) => onSelect(entry, event.currentTarget)}
                  className="text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                >
                  <span className="flex items-start gap-2 text-base font-semibold leading-6 text-foreground">
                    <FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="line-clamp-2 break-words">{entry.item.title}</span>
                  </span>
                </button>
                <p className="mt-2 truncate text-sm text-muted-foreground">
                  {[creatorLabel(entry.item), entry.item.issuedYear].filter(Boolean).join(' · ')}
                </p>
                {entry.item.containerTitle ? (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {entry.item.containerTitle}
                  </p>
                ) : null}
                <div className="pointer-events-none mt-3 flex flex-wrap items-center gap-3">
                  <ResourceTagBadges
                    reference={{ resourceType: 'literature.item', resourceId: entry.id }}
                    removable={false}
                  />
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs',
                      hasPdf ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    {hasPdf ? t('With PDF') : t('Without PDF')}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="relative z-10"
                aria-label={t('Edit {{title}}', { title: entry.item.title })}
                onClick={(event) => onDetails(entry, event.currentTarget)}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
