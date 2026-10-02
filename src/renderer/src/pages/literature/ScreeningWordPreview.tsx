import { useEffect, useState } from 'react'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ErrorNotice } from '@/components/error-notice'
import { validateOfficePackage } from '../workspace/previews/office-package'
import { renderOfficeFile, type OfficeRenderCleanup } from '../workspace/previews/office-renderers'

// A separate, script-free document keeps Word styles and content out of the application DOM.
const FRAME_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data: blob:"><style>
html,body{margin:0;min-height:100%;background:#e5e7eb;color:#111;color-scheme:light}
body{overflow:auto}.docx-wrapper{padding:20px!important;background:transparent!important;gap:20px}
.docx-wrapper>section.docx{flex-shrink:0;margin:0!important;box-shadow:0 2px 8px #0002}
</style></head><body></body></html>`
const MIN_ZOOM = 25
const MAX_ZOOM = 200

export function ScreeningWordPreview({
  bytes,
  name,
  onEscape
}: {
  bytes: Uint8Array
  name: string
  onEscape?: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [frameDocument, setFrameDocument] = useState<Document>()
  const [rendered, setRendered] = useState<{
    bytes: Uint8Array
    name: string
    document: Document
    retry: number
    host?: HTMLDivElement
    error?: true
  }>()
  const [retry, setRetry] = useState(0)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [displayZoom, setDisplayZoom] = useState(100)
  const current =
    rendered?.bytes === bytes &&
    rendered.name === name &&
    rendered.document === frameDocument &&
    rendered.retry === retry
      ? rendered
      : undefined
  const host = current?.host
  const status = current?.error ? 'error' : host ? 'ready' : 'loading'

  useEffect(() => {
    if (!frameDocument || !onEscape) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.isComposing) onEscape()
    }
    frameDocument.addEventListener('keydown', onKeyDown)
    return () => frameDocument.removeEventListener('keydown', onKeyDown)
  }, [frameDocument, onEscape])

  useEffect(() => {
    if (!frameDocument) return
    const controller = new AbortController()
    const container = frameDocument.createElement('div')
    frameDocument.body.replaceChildren(container)
    let dispose: OfficeRenderCleanup | undefined
    void (async () => {
      try {
        await validateOfficePackage(bytes, 'docx', controller.signal)
        controller.signal.throwIfAborted()
        const cleanup = await renderOfficeFile({
          bytes,
          extension: 'docx',
          name,
          container,
          signal: controller.signal,
          fitToWidth: false
        })
        if (controller.signal.aborted) {
          await cleanup()
          return
        }
        dispose = cleanup
        if (!container.querySelector('section.docx')) throw new Error('No Word pages rendered')
        await frameDocument.fonts?.ready
        if (controller.signal.aborted) return
        setRendered({ bytes, name, document: frameDocument, retry, host: container })
      } catch {
        if (!controller.signal.aborted)
          setRendered({ bytes, name, document: frameDocument, retry, error: true })
      }
    })()
    return () => {
      controller.abort()
      void dispose?.()
      container.remove()
    }
  }, [bytes, frameDocument, name, retry])

  useEffect(() => {
    if (!host || !frameDocument?.defaultView) return
    const view = frameDocument.defaultView
    const pages = Array.from(host.querySelectorAll<HTMLElement>('section.docx'))
    const wrapper = host.querySelector<HTMLElement>('.docx-wrapper')
    const update = (): void => {
      const width = Math.max(
        ...pages.map((page) => Number.parseFloat(view.getComputedStyle(page).width))
      )
      if (!Number.isFinite(width) || width <= 0) return
      const available = Math.max(1, frameDocument.documentElement.clientWidth - 40)
      const percent =
        zoom === 'fit' ? Math.max(MIN_ZOOM, Math.min(100, (available / width) * 100)) : zoom
      pages.forEach((page) => {
        page.style.zoom = String(percent / 100)
      })
      if (wrapper)
        wrapper.style.alignItems = (width * percent) / 100 > available ? 'flex-start' : 'center'
      setDisplayZoom(Math.round(percent))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frameDocument.documentElement)
    return () => observer.disconnect()
  }, [host, frameDocument, zoom])

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" data-word-preview-state={status}>
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border bg-card p-2">
        <Button
          size="icon"
          variant="ghost"
          disabled={status !== 'ready' || displayZoom <= MIN_ZOOM}
          aria-label={t('Zoom out')}
          onClick={() => setZoom(Math.max(MIN_ZOOM, displayZoom - 10))}
        >
          <ZoomOut className="size-4" />
        </Button>
        <output className="min-w-14 text-center text-xs tabular-nums">{displayZoom}%</output>
        <Button
          size="icon"
          variant="ghost"
          disabled={status !== 'ready' || displayZoom >= MAX_ZOOM}
          aria-label={t('Zoom in')}
          onClick={() => setZoom(Math.min(MAX_ZOOM, displayZoom + 10))}
        >
          <ZoomIn className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={status !== 'ready'}
          onClick={() => setZoom('fit')}
        >
          {t('Fit to width')}
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <iframe
          title={t('Preview of {{name}}', { name })}
          sandbox="allow-same-origin"
          srcDoc={FRAME_HTML}
          className="h-full w-full border-0"
          style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
          onLoad={(event) => setFrameDocument(event.currentTarget.contentDocument ?? undefined)}
        />
        {status === 'loading' ? (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-2 bg-muted text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" />
            {t('Loading preview…')}
          </div>
        ) : status === 'error' ? (
          <div className="absolute inset-0 overflow-auto bg-background p-5">
            <ErrorNotice
              role="alert"
              tone="amber"
              title={t('Preview unavailable')}
              description={t(
                'Unable to preview this export file. Download the package to open it.'
              )}
              primaryButton={{ label: t('Retry'), onClick: () => setRetry((value) => value + 1) }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
