import { BookOpenText, House, LineChart, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    { label: t('Research home'), icon: House, onClick: onHome, active: active === 'home' },
    {
      label: t('Library'),
      icon: BookOpenText,
      onClick: onLibrary,
      active: active === 'library'
    },
    {
      label: t('Research workspace'),
      icon: LineChart,
      onClick: onAnalysis,
      active: active === 'analysis'
    }
  ]
  return (
    <header className="research-workbench-header research-glass flex shrink-0 flex-wrap items-center">
      <button
        type="button"
        onClick={onHome}
        aria-label={t('Back to Home')}
        className="research-brand shrink-0 rounded-full px-2 py-1.5 font-serif text-[22px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        EconoMind
      </button>
      <nav
        aria-label={t('Workbench modules')}
        className="research-module-nav order-3 w-full min-w-0 items-center gap-1 md:order-none md:mx-auto md:w-auto"
      >
        {links.map(({ label, icon: Icon, onClick, active }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'research-module-link flex min-h-10 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              active
                ? 'font-medium text-primary'
                : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      <div className="research-header-actions ml-auto flex shrink-0 items-center gap-1 md:ml-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-foreground"
          aria-label={settingsLabel ?? t('Settings')}
          onClick={onSettings}
        >
          <Settings className="size-4" aria-hidden="true" />
        </Button>
        {actions}
      </div>
    </header>
  )
}
