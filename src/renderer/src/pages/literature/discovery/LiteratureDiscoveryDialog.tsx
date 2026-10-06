import * as Dialog from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  dialogCloseButtonClassName,
  dialogDescriptionClassName,
  dialogHeaderClassName,
  dialogOverlayClassName,
  dialogPanelClassName,
  dialogTitleClassName
} from '@/components/ui/dialog-chrome'
import { LiteratureDiscoveryPanel } from './LiteratureDiscoveryPanel'

// This dialog owns its layout instead of reusing LiteratureImportDialogFrame: the shared panel
// style scrolls itself, which leaves the flex column without a fixed height and makes the body
// impossible to scroll. Here the panel is overflow-hidden and exactly one child scrolls.
export function LiteratureDiscoveryDialog({
  onClose,
  collectionId,
  onImported
}: {
  onClose: () => void
  collectionId?: string
  onImported?: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={dialogOverlayClassName} />
        <Dialog.Content
          className={dialogPanelClassName(
            'flex max-h-[calc(100dvh-2rem)] w-[min(740px,calc(100vw-2rem))] flex-col overflow-hidden p-0'
          )}
        >
          <div className={cn(dialogHeaderClassName, 'shrink-0')}>
            <div className="min-w-0">
              <Dialog.Title className={dialogTitleClassName}>{t('Search OpenAlex')}</Dialog.Title>
              <Dialog.Description
                className={cn(dialogDescriptionClassName, '[overflow-wrap:anywhere]')}
              >
                {t('Search by title, abstract or full text, then import selected records.')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={dialogCloseButtonClassName}
                aria-label={t('Close')}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <LiteratureDiscoveryPanel collectionId={collectionId} onImported={onImported} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default LiteratureDiscoveryDialog
