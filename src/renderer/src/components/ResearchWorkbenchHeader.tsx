import { BookOpenText, House, LineChart, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { preloadWorkbenchPage } from '@/lib/workbench-page-loaders'

type Props = {
  active: 'home' | 'library' | 'analysis'
  settingsLabel?: string
  actions?: ReactNode
  onHome: () => void
  onLibrary: () => void
  onAnalysis: () => void
  onSettings: () => void
}

export function ResearchWorkbenchHeader({
  active,
  settingsLabel,
  actions,
  onHome,
  onLibrary,
  onAnalysis,
  onSettings
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  const links = [
    {
      label: t('Research home'),
      icon: House,
      onClick: onHome,
      active: active === 'home',
      page: undefined
    },
    {
      label: t('Library'),
      icon: BookOpenText,
      onClick: onLibrary,
      page: 'library' as const,
      active: active === 'library'
    },
    {
      label: t('Research workspace'),
      icon: LineChart,
      onClick: onAnalysis,
      page: 'workspace' as const,
      active: active === 'analysis'
    }
  ]
  return (
    <header className="research-workbench-header flex shrink-0 flex-wrap items-center gap-x-6 border-b border-border bg-background px-5 lg:px-8">
      <button
        type="button"
        onClick={onHome}
        aria-label={t('Back to Home')}
        className="py-4 font-serif text-2xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        EconoMind
      </button>
      <nav
        aria-label={t('Workbench modules')}
        className="order-3 flex w-full items-stretch gap-1 overflow-x-auto md:order-none md:mx-auto md:w-auto lg:gap-5"
      >
        {links.map(({ label, icon: Icon, onClick, active, page }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            onPointerEnter={() => page && void preloadWorkbenchPage(page)}
            onFocus={() => page && void preloadWorkbenchPage(page)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-4 text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:py-5',
              active ? 'border-primary font-medium text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-auto md:ml-0"
        aria-label={settingsLabel ?? t('Settings')}
        onClick={onSettings}
      >
        <Settings className="size-4" aria-hidden="true" />
      </Button>
      {actions}
    </header>
  )
}
