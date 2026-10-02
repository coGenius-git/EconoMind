import { useTranslation } from 'react-i18next'
import { AppLogo } from '@/components/AppLogo'
import { useUpdateStore } from '@/stores/update-store'
import { APP } from '../../../../shared/app-config'
import { SettingsSection } from './SettingsLayout'

export type AppVersionSectionPreviewState =
  'default' | 'hover' | 'focus' | 'active' | 'disabled' | 'loading' | 'error' | 'success'
export function AppVersionSection({
  previewState
}: {
  previewState?: AppVersionSectionPreviewState
}): React.JSX.Element {
  const { t } = useTranslation()
  const version = useUpdateStore((s) => s.appInfo?.version ?? s.status.current)
  return (
    <SettingsSection title={t('About')} aria-label={t('App version')}>
      <div className="flex items-center gap-3" data-preview-state={previewState}>
        <AppLogo className="size-12 rounded-lg" />
        <div>
          <p className="text-sm font-semibold">
            {APP.name}{' '}
            <span className="ml-2 text-xs font-normal text-muted-foreground">v{version}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('Customized edition based on Open Science (AIPOCH), licensed under Apache-2.0.')}
          </p>
        </div>
      </div>
    </SettingsSection>
  )
}
