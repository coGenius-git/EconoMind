import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import * as Dialog from '@/components/ui/dialog'
import { useNavigationStore } from '@/stores/navigation-store'
import { hasSeenProductTour, useProductTourStore } from '@/stores/product-tour-store'
import { useSettingsStore } from '@/stores/settings-store'

const steps = [
  {
    target: 'home',
    title: 'Your research home',
    description:
      'This is your starting point. Switch between the literature library and research workspace here, and return home to see your projects and recent work.'
  },
  {
    target: 'new-project',
    title: 'Start with a project',
    description:
      'Create a project for each research topic. Choose its working folder to keep your data, code, conversations, and results together.'
  },
  {
    target: 'projects',
    title: 'Manage your projects',
    description:
      'Open a project to continue researching. Project menus let you rename, pin, archive, or export your work.'
  },
  {
    target: 'recent-sessions',
    title: 'Continue a conversation',
    description:
      'Recent conversations appear here. Reopen one to continue from its saved messages and results without starting over.'
  },
  {
    target: 'library',
    title: 'Explore your literature library',
    description:
      'Search for papers, import references and PDFs, and organize collections. Read and annotate papers, screen literature, and explore bibliometric analysis here.'
  },
  {
    target: 'workspace',
    title: 'Work with your research agents',
    description:
      'Inside a project, use the conversation area to describe a task and choose a Specialist from the sidebar. Agents can analyze data and run code in Notebooks; the files and preview area shows your documents, charts, and results.'
  },
  {
    target: 'search',
    title: 'Find your research quickly',
    description:
      'Search across projects, conversations, literature, and files. You can also open search with Cmd/Ctrl+K.'
  },
  {
    target: 'settings',
    title: 'Make the workspace yours',
    description:
      'Manage models, Specialists, skills, connectors, runtimes, and other preferences in Settings. To see this guide again, open Settings → General → Restart new user guide.'
  }
] as const

type Spotlight = { left: number; top: number; width: number; height: number }

// The whole tour uses existing entry points, even before the first project exists. It never
// creates sample projects, selects an agent, sends a message, or changes model configuration.
export function ProductTour({ ready }: { ready: boolean }): React.JSX.Element | null {
  const { t } = useTranslation()
  const onboardingCompletedAt = useSettingsStore((state) => state.onboardingCompletedAt)
  const view = useNavigationStore((state) => state.view)
  const { active, requested, stepIndex, dismissedFor, beginTour, setStep, finishTour } =
    useProductTourStore()
  const visible = ready && view === 'home' && active && onboardingCompletedAt !== undefined

  useEffect(() => {
    if (!ready || view !== 'home' || onboardingCompletedAt === undefined || active) return
    if (
      requested ||
      (dismissedFor !== onboardingCompletedAt && !hasSeenProductTour(onboardingCompletedAt))
    ) {
      beginTour()
    }
  }, [active, beginTour, dismissedFor, onboardingCompletedAt, ready, requested, view])

  if (!visible) return null
  return (
    <TourDialog
      stepIndex={stepIndex}
      onStep={setStep}
      onFinish={() => finishTour(onboardingCompletedAt)}
      t={t}
    />
  )
}

function TourDialog({
  stepIndex,
  onStep,
  onFinish,
  t
}: {
  stepIndex: number
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
    const target = document.querySelector<HTMLElement>(`[data-product-tour="${step.target}"]`)
    target?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'instant' })
    let frame = 0
    const measure = (): void => {
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
    const observer = new ResizeObserver(scheduleMeasure)
    if (target) observer.observe(target)
    if (content) observer.observe(content)
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, true)
    nextButton.current?.focus({ preventScroll: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
    }
  }, [content, step.target, t])

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
