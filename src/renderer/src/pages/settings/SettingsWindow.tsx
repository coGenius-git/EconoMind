import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorNotice } from '@/components/error-notice'
import { PermissionUndoSnackbar } from '@/components/PermissionUndoSnackbar'
import { useSettingsUndoPortal } from '@/components/use-settings-undo-portal'
import { useApplicationStartup } from '@/hooks/useApplicationStartup'
import { useSettingsStore } from '@/stores/settings-store'
import { useProjectStore } from '@/stores/project-store'
import {
  parseSettingsWindowRoute,
  type SettingsWindowNavigation
} from '../../../../shared/settings-window'
import { SettingsPage, type SettingsPageHandle } from './SettingsPage'
import type { SettingsRoute } from './settings-navigation'
import { SETTINGS_WINDOW_WORKFLOW_EVENT } from './settings-window-workflow'

// Like the modal Settings surface, editing owns Ctrl+Z; undo receipts remain clickable.
const allowsArchiveShortcut = (): boolean => false

export function SettingsWindow(): React.JSX.Element {
  const { t } = useTranslation()
  const startup = useApplicationStartup()
  const pageRef = useRef<SettingsPageHandle>(null)
  const startingTour = useRef(false)
  const [startTourError, setStartTourError] = useState(false)
  const undoPortal = useSettingsUndoPortal(
    <PermissionUndoSnackbar allowsArchiveShortcut={allowsArchiveShortcut} />
  )
  const close = useCallback(() => {
    void window.api.window.confirmSettingsClose?.()
  }, [])
  const navigate = (kind: SettingsWindowNavigation['kind'], id: string): void => {
    void window.api.window.navigateMain?.({ kind, id })
  }
  const startTour = useCallback(() => {
    if (startingTour.current) return
    startingTour.current = true
    setStartTourError(false)
    void (async () => {
      try {
        const { navigateMain, confirmSettingsClose } = window.api.window
        if (!navigateMain || !confirmSettingsClose)
          throw new Error('Settings navigation unavailable')
        await navigateMain({ kind: 'product-tour', id: 'restart' })
        await confirmSettingsClose()
      } catch {
        setStartTourError(true)
      } finally {
        startingTour.current = false
      }
    })()
  }, [])

  useEffect(() => {
    const launch = (event: Event): void => {
      const request = (event as CustomEvent<SettingsWindowNavigation>).detail
      pageRef.current?.requestLeave(() => {
        void window.api.window.navigateMain?.(request).then(close).catch(console.error)
      })
    }
    window.addEventListener(SETTINGS_WINDOW_WORKFLOW_EVENT, launch)
    return () => window.removeEventListener(SETTINGS_WINDOW_WORKFLOW_EVENT, launch)
  }, [close])

  useEffect(() => {
    document.title = `EconoMind — ${t('Settings')}`
  }, [t])
  useEffect(() => {
    const acceptRoute = (serialized: string): void => {
      const route = parseSettingsWindowRoute(serialized)
      if (route) {
        useSettingsStore.getState().openSettingsToRoute(route as SettingsRoute)
        void window.api.window.takeSettingsRoute?.()
      }
    }
    const unsubscribe = window.api.window.onSettingsRoute?.(acceptRoute)
    void window.api.window.takeSettingsRoute?.().then((route) => {
      if (route) acceptRoute(route)
    })
    return unsubscribe
  }, [])
  useEffect(
    () =>
      window.api.settings.onChanged?.((snapshot) => {
        useSettingsStore.getState().acceptCommittedSnapshot(snapshot)
      }),
    []
  )
  useEffect(() => {
    const refresh = (): void => {
      void useSettingsStore.getState().load()
      void useProjectStore.getState().loadProjects()
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  useEffect(() => {
    const unsubscribeClose = window.api.window.onSettingsCloseRequest?.(() => {
      if (pageRef.current) pageRef.current.requestLeave(close)
      else close()
    })
    const closePane = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        pageRef.current?.closeActivePane()
      }
    }
    window.addEventListener('keydown', closePane)
    return () => {
      unsubscribeClose?.()
      window.removeEventListener('keydown', closePane)
    }
  }, [close])

  if (!startup.settings.isLoaded)
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
        {startup.settings.loadError ? (
          <ErrorNotice
            fullPage
            title={t('Settings could not be loaded')}
            description={startup.settings.loadError}
            primaryButton={{ label: t('Retry'), onClick: () => void startup.settings.retry() }}
          />
        ) : (
          <span role="status">{t('Loading settings…')}</span>
        )}
      </main>
    )
  return (
    <>
      <div aria-hidden="true" className="research-page pointer-events-none fixed inset-0">
        <div
          data-slot="settings-window-glass"
          className="research-glass absolute inset-0 border-0 shadow-none"
        />
      </div>
      {undoPortal.background}
      <SettingsPage
        ref={pageRef}
        undoHostRef={undoPortal.settingsHostRef}
        standalone
        open
        onClose={close}
        onStartTour={startTour}
        startTourError={startTourError}
        onOpenSession={(id) => navigate('session', id)}
        onOpenProject={(id) => navigate('project', id)}
        onOpenLiteratureItem={(id) => navigate('literature', id)}
        canDeleteProjects={startup.sessions.canDeleteSessionsAndProjects}
        hasCompleteSessionCatalog={startup.sessions.hasCompleteSessionCatalog}
        catalogRecovery={startup.sessions.catalogRecovery}
        onRetryCatalogRecovery={startup.sessions.retryLoad}
        sessionLoadError={startup.sessions.loadError}
      />
    </>
  )
}
