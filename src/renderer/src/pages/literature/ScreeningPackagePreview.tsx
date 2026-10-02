import { useMemo, useRef, useState } from 'react'
import { strFromU8, unzipSync } from 'fflate'
import { FileText, Maximize2, Minimize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import * as Dialog from '@/components/ui/dialog'
import { ErrorNotice } from '@/components/error-notice'
import { cn } from '@/lib/utils'
import type { ScreeningResponse } from '../../../../shared/literature-screening'
import { ScreeningWordPreview } from './ScreeningWordPreview'

// Preview the files from the actual export, rendering only the selected Word document.
export function ScreeningPackagePreview({
  data
}: {
  data: NonNullable<ScreeningResponse['export']>
}): React.JSX.Element {
  const { t } = useTranslation()
  const [selection, setSelection] = useState(data.files[0] ?? '')
  const [expanded, setExpanded] = useState(false)
  const expandButton = useRef<HTMLButtonElement>(null)
  const selected = data.files.includes(selection) ? selection : (data.files[0] ?? '')
  const archive = useMemo(() => {
    try {
      return unzipSync(Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0)))
    } catch {
      return undefined
    }
  }, [data.base64])
  const preview = useMemo(() => {
    try {
      const bytes = archive?.[selected]
      if (!bytes) throw new Error('Missing export file')
      if (selected.endsWith('.json'))
        return { text: JSON.stringify(JSON.parse(strFromU8(bytes)), null, 2) }
      if (!selected.endsWith('.docx')) throw new Error('Unsupported export file')
      return { bytes }
    } catch {
      return { error: true }
    }
  }, [archive, selected])

  const content = (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-1">
      <div className="min-h-0 min-w-0 border-b border-border bg-card p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <label className="block text-xs font-medium">
          {t('Export file')}
          <select
            className="mt-2 block w-full rounded-md border border-border bg-background p-2 lg:hidden"
            value={selected}
            onChange={(event) => setSelection(event.target.value)}
          >
            {data.files.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 hidden space-y-1 lg:block">
          {data.files.map((file) => (
            <button
              key={file}
              type="button"
              aria-pressed={selected === file}
              className={cn(
                'flex w-full items-start gap-2 rounded-md px-2 py-3 text-left text-xs',
                selected === file
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              onClick={() => setSelection(file)}
            >
              <FileText className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{file}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 min-w-0 overflow-hidden bg-muted">
        {preview.error ? (
          <div className="p-5">
            <ErrorNotice
              tone="amber"
              title={t('Preview unavailable')}
              description={t(
                'Unable to preview this export file. Download the package to open it.'
              )}
            />
          </div>
        ) : preview.text !== undefined ? (
          <pre className="h-full overflow-auto whitespace-pre-wrap break-words bg-background p-5 text-xs">
            {preview.text}
          </pre>
        ) : preview.bytes ? (
          <ScreeningWordPreview
            key={selected}
            bytes={preview.bytes}
            name={selected}
            onEscape={expanded ? () => setExpanded(false) : undefined}
          />
        ) : null}
      </div>
    </div>
  )

  return (
    <section
      aria-label={t('Evidence package preview')}
      className="mt-6 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="font-semibold">{t('Evidence package preview')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('Content preview of the files in your download. Word page layout may differ.')}
          </p>
        </div>
        <Button
          ref={expandButton}
          size="icon"
          variant="ghost"
          aria-label={t('Expand preview panel')}
          onClick={() => setExpanded(true)}
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
      <div className="h-[min(70vh,48rem)] min-h-80">{!expanded ? content : null}</div>
      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              expandButton.current?.focus()
            }}
            className="fixed inset-3 z-50 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg sm:inset-5"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
              <Dialog.Title className="font-semibold">{t('Evidence package preview')}</Dialog.Title>
              <Dialog.Close asChild>
                <Button size="icon" variant="ghost" aria-label={t('Exit full screen')}>
                  <Minimize2 className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1">{content}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
