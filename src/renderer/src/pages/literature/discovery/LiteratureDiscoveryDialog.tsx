import * as Dialog from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  dialogCloseButtonClassName,
  dialogDescriptionClassName,
  dialogHeaderClassName,
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
        <Dialog.Overlay className="research-settings-backdrop fixed inset-0 z-50 data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="research-discovery-dialog research-glass fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(740px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden text-foreground outline-none data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className={cn(dialogHeaderClassName, 'shrink-0')}>
            <div className="min-w-0">
              <Dialog.Title className={dialogTitleClassName}>
                {t('Search external sources')}
              </Dialog.Title>
              <Dialog.Description
                className={cn(dialogDescriptionClassName, '[overflow-wrap:anywhere]')}
              >
                {t('Find records by topic and criteria, then import the ones you want to screen.')}
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
            <LiteratureDiscoveryPanel
              collectionId={collectionId}
              onImported={onImported}
              showHeader={false}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default LiteratureDiscoveryDialog
