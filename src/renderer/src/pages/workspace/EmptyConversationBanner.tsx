import { AppLogo } from '@/components/AppLogo'
import { useTranslation } from 'react-i18next'

// Centered placeholder for a brand-new conversation with no messages yet. Mounted as an absolute
// overlay inside MessageScroller (not MessageScrollerContent — the scroller only measures Content's
// direct children), so it never participates in scroll anchoring.
const EmptyConversationBanner = (): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <div
      data-testid="empty-conversation-banner"
      className="pointer-events-none absolute inset-x-0 top-[42%] flex -translate-y-1/2 flex-col items-center gap-4 px-6 text-center"
    >
      <AppLogo className="size-16 rounded-2xl object-contain" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {t('What will you research in EconoMind?')}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {t('Discover, share, and collaborate on research that matters')}
        </p>
      </div>
    </div>
  )
}

export { EmptyConversationBanner }
