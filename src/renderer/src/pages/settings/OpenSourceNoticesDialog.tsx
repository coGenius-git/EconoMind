// Copyright 2026 EconoMind contributors. Licensed under Apache-2.0; see LICENSE and NOTICE.
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import licenseText from '../../../../../LICENSE?raw'
import noticeText from '../../../../../NOTICE?raw'
import attributionText from '../../../../../docs/OPEN_SOURCE.md?raw'
import { Button } from '@/components/ui/button'
import * as Dialog from '@/components/ui/dialog'
import {
  dialogBodyClassName,
  dialogCloseButtonClassName,
  dialogDescriptionClassName,
  dialogHeaderClassName,
  dialogOverlayClassName,
  dialogPanelClassName,
  dialogTitleClassName
} from '@/components/ui/dialog-chrome'

const documents = [
  { name: 'OPEN_SOURCE.md', text: attributionText },
  { name: 'NOTICE', text: noticeText },
  { name: 'LICENSE (Apache-2.0)', text: licenseText }
]

export function OpenSourceNoticesDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={dialogOverlayClassName} />
        <Dialog.Content
          className={dialogPanelClassName(
            'flex max-h-[calc(100dvh-2rem)] w-[min(760px,calc(100vw-2rem))] flex-col overflow-hidden p-0'
          )}
        >
          <div className={dialogHeaderClassName}>
            <div className="min-w-0 flex-1">
              <Dialog.Title className={dialogTitleClassName}>
                {t('Open-source license')}
              </Dialog.Title>
              <Dialog.Description className={dialogDescriptionClassName}>
                {t(
                  'The license and attribution notices are bundled with this app and available offline.'
                )}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('Close')}
                className={dialogCloseButtonClassName}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className={`${dialogBodyClassName} min-h-0 overflow-y-auto overscroll-contain`}>
            <div className="space-y-6">
              {documents.map((document) => (
                <section key={document.name} aria-label={document.name}>
                  <h3 className="mb-2 text-sm font-semibold">{document.name}</h3>
                  <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-4 font-sans text-xs leading-relaxed text-foreground">
                    {document.text}
                  </pre>
                </section>
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
