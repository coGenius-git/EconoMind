import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PRODUCT_TOUR_STEPS as steps } from './product-tour-steps'
import { Button } from '@/components/ui/button'
import * as Dialog from '@/components/ui/dialog'
import { OverlayLayerProvider } from '@/components/ui/overlay-layer'
import { useNavigationStore } from '@/stores/navigation-store'
import { hasSeenProductTour, useProductTourStore } from '@/stores/product-tour-store'
import { useSettingsStore } from '@/stores/settings-store'
type Spotlight = { left: number; top: number; width: number; height: number }

// The whole tour uses existing entry points, even before the first project exists. It never
// creates sample projects, selects an agent, sends a message, or changes model configuration.
export function ProductTour({ ready }: { ready: boolean }): React.JSX.Element | null {
  const { t } = useTranslation()
  const onboardingCompletedAt = useSettingsStore((state) => state.onboardingCompletedAt)
  const view = useNavigationStore((state) => state.view)
  const {
    active,
    requested,
    stepIndex,
    workspaceProjectId,
    dismissedFor,
    beginTour,
    setStep,
    finishTour
  } = useProductTourStore()
  const visible = ready && active && onboardingCompletedAt !== undefined
  const step = steps[stepIndex]

  useEffect(() => {
    if (!ready || view !== 'home' || onboardingCompletedAt === undefined || active) return
    if (
      requested ||
      (dismissedFor !== onboardingCompletedAt && !hasSeenProductTour(onboardingCompletedAt))
    ) {
      beginTour()
    }
  }, [active, beginTour, dismissedFor, onboardingCompletedAt, ready, requested, view])

  useEffect(() => {
    if (!visible || view === step.view) return
    const navigation = useNavigationStore.getState()
    if (step.view === 'library') navigation.openLibrary('automatic', { section: 'library' })
    else if (step.view === 'workspace') navigation.openTourWorkspace(workspaceProjectId)
    else navigation.goHome('automatic')
  }, [step.view, view, visible, workspaceProjectId])

  if (!visible) return null
  return (
    <OverlayLayerProvider value={100}>
      <TourDialog
        stepIndex={stepIndex}
        pageReady={view === step.view}
        onStep={setStep}
        onFinish={() => finishTour(onboardingCompletedAt)}
        t={t}
      />
    </OverlayLayerProvider>
  )
}

function TourDialog({
  stepIndex,
  pageReady,
  onStep,
  onFinish,
  t
}: {
  stepIndex: number
  pageReady: boolean
  onStep: (index: number) => void
  onFinish: () => void
  t: ReturnType<typeof useTranslation>['t']
}): React.JSX.Element {
  const step = steps[stepIndex]
  const maskId = useId()
  const nextButton = useRef<HTMLButtonElement>(null)
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  const [spotlight, setSpotlight] = useState<Spotlight>()
  const [position, setPosition] = useState({ left: 16, top: 16 })

  useLayoutEffect(() => {
    // Pages are lazy-loaded and retained in Activity. Wait for a visible, mounted target.
    let target: HTMLElement | undefined
    let frame = 0
    const observer = new ResizeObserver(() => scheduleMeasure())
    const measure = (): void => {
      const nextTarget = pageReady
        ? Array.from(
            document.querySelectorAll<HTMLElement>(`[data-product-tour="${step.target}"]`)
          ).find((element) => {
            const bounds = element.getBoundingClientRect()
            return (
              bounds.width > 0 &&
              bounds.height > 0 &&
              bounds.right > 0 &&
              bounds.left < window.innerWidth
            )
          })
        : undefined
      if (target !== nextTarget) {
        if (target) observer.unobserve(target)
        target = nextTarget
        if (target) {
          observer.observe(target)
          target.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
        }
      }
      const bounds = target?.getBoundingClientRect()
      const rect =
        bounds && bounds.width > 0 && bounds.height > 0
          ? {
              left: Math.max(8, bounds.left - 5),
              top: Math.max(8, bounds.top - 5),
              width: Math.min(
                bounds.width + 10,
                window.innerWidth - Math.max(8, bounds.left - 5) - 8
              ),
              height: Math.min(
                bounds.height + 10,
                window.innerHeight - Math.max(8, bounds.top - 5) - 8
              )
            }
          : undefined
      setSpotlight(rect)
      const cardWidth = content?.offsetWidth ?? Math.min(400, window.innerWidth - 32)
      const cardHeight = content?.offsetHeight ?? 280
      const below = rect ? rect.top + rect.height + 16 : (window.innerHeight - cardHeight) / 2
      const above = rect ? rect.top - cardHeight - 16 : below
      setPosition({
        left: Math.max(
          16,
          Math.min(
            rect ? rect.left : (window.innerWidth - cardWidth) / 2,
            window.innerWidth - cardWidth - 16
          )
        ),
        top: Math.max(
          16,
          Math.min(
            below + cardHeight <= window.innerHeight - 16 ? below : above,
            window.innerHeight - cardHeight - 16
          )
        )
      })
    }
    const scheduleMeasure = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    const changes = new MutationObserver(scheduleMeasure)
    changes.observe(document.body, { childList: true, subtree: true })
    if (content) observer.observe(content)
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, true)
    // Mobile drawers move with a CSS transform, which does not trigger ResizeObserver.
    window.addEventListener('transitionend', scheduleMeasure, true)
    nextButton.current?.focus({ preventScroll: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      changes.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
      window.removeEventListener('transitionend', scheduleMeasure, true)
    }
  }, [content, pageReady, step.target, t])

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onFinish()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0" data-testid="product-tour-overlay">
          <svg className="pointer-events-none size-full" aria-hidden="true">
            <defs>
              <mask id={maskId}>
                <rect width="100%" height="100%" fill="white" />
                {spotlight ? (
                  <rect
                    width={spotlight.width}
                    height={spotlight.height}
                    x={spotlight.left}
                    y={spotlight.top}
                    rx="12"
                    fill="black"
                  />
                ) : null}
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              className="fill-background/80"
              mask={`url(#${maskId})`}
            />
          </svg>
          {spotlight ? (
            <div
              data-testid="product-tour-highlight"
              data-tour-target={step.target}
              aria-hidden="true"
              className="pointer-events-none absolute rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background"
              style={spotlight}
            />
          ) : null}
        </Dialog.Overlay>
        <Dialog.Content
          ref={setContent}
          data-testid="product-tour"
          data-tour-view={step.view}
          aria-describedby="product-tour-description"
          className="fixed flex max-h-[calc(100dvh-32px)] w-[min(400px,calc(100vw-32px))] flex-col overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl"
          style={position}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document
              .querySelector<HTMLElement>('[data-product-tour="settings"]')
              ?.focus({ preventScroll: true })
          }}
        >
          <Dialog.Title className="text-xs font-medium text-primary">
            {t('New user guide')}
          </Dialog.Title>
          <div aria-live="polite" aria-atomic="true" className="mt-3">
            <h2 className="text-lg font-semibold">{t(step.title)}</h2>
            <Dialog.Description
              id="product-tour-description"
              className="mt-3 text-sm leading-6 text-muted-foreground"
            >
              {t(step.description)}
            </Dialog.Description>
            <p className="mt-4 text-xs tabular-nums text-muted-foreground">
              {t('Step {{current}} of {{total}}', { current: stepIndex + 1, total: steps.length })}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={onFinish}>
              {t('Skip guide')}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={stepIndex === 0}
                onClick={() => onStep(stepIndex - 1)}
              >
                {t('Previous step')}
              </Button>
              <Button
                ref={nextButton}
                type="button"
                disabled={!spotlight}
                onClick={() =>
                  stepIndex === steps.length - 1 ? onFinish() : onStep(stepIndex + 1)
                }
              >
                {stepIndex === steps.length - 1 ? t('Finish guide') : t('Next step')}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
