import { Activity, Suspense, useEffect, useState, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ResearchWorkbenchHeader } from './ResearchWorkbenchHeader'
import { preloadWorkbenchPage } from '@/lib/workbench-page-loaders'
import { useNavigationStore, type NavigationView } from '@/stores/navigation-store'
import { useProjectStore } from '@/stores/project-store'
import { useSettingsStore } from '@/stores/settings-store'

export const RetainedWorkspacePage = ({
  active,
  children
}: {
  active: boolean
  children: (projectId: string | undefined) => ReactNode
}): React.JSX.Element | null => {
  const projectId = useNavigationStore((state) => state.activeProjectId)
  const [scope, setScope] = useState<{ projectId: string | undefined }>()
  if (active && (!scope || scope.projectId !== projectId)) setScope({ projectId })
  // Retain only a visited workspace. Home clears navigation's project selection, so keep the last
  // visible scope while hidden rather than replacing its transcript with an empty project.
  const visibleScope = active ? { projectId } : scope
  return visibleScope ? (
    <Activity mode={active ? 'visible' : 'hidden'}>{children(visibleScope.projectId)}</Activity>
  ) : null
}

const WorkbenchPageLoading = ({ view }: { view: NavigationView }): React.JSX.Element => {
  const { t } = useTranslation()
  return (
    <main className="flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <ResearchWorkbenchHeader
        active={view === 'workspace' ? 'analysis' : view}
        onHome={() => useNavigationStore.getState().goHome('user')}
        onLibrary={() => useNavigationStore.getState().openLibrary('user')}
        onAnalysis={() => {
          const navigation = useNavigationStore.getState()
          const projectId =
            navigation.activeProjectId ??
            useProjectStore.getState().projects.find((project) => !project.archivedAt)?.id
          if (projectId) navigation.openProject(projectId, 'user')
          else navigation.requestProjectCreation()
        }}
        onSettings={() => useSettingsStore.getState().openSettings()}
      />
      <div
        role="status"
        className="flex flex-1 items-center justify-center gap-3 text-muted-foreground"
      >
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />
        <span>{t('Loading…')}</span>
      </div>
    </main>
  )
}

export const WorkbenchPageBoundary = ({
  view,
  children
}: {
  view: NavigationView
  children: ReactNode
}): React.JSX.Element => {
  useEffect(() => {
    let cancelled = false
    let cancelScheduled: (() => void) | undefined
    const schedule = (page: 'library' | 'workspace', after?: () => void): void => {
      const load = (): void => {
        if (!cancelled) void preloadWorkbenchPage(page).then(() => !cancelled && after?.())
      }
      if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(load, { timeout: 1500 })
        cancelScheduled = () => window.cancelIdleCallback(id)
      } else {
        const id = window.setTimeout(load, 150)
        cancelScheduled = () => window.clearTimeout(id)
      }
    }
    // Paint the current screen first, then warm one module at a time without mounting hidden pages.
    const first = view === 'workspace' ? 'workspace' : 'library'
    schedule(first, () => schedule(first === 'library' ? 'workspace' : 'library'))
    return () => {
      cancelled = true
      cancelScheduled?.()
    }
  }, [view])

  return <Suspense fallback={<WorkbenchPageLoading view={view} />}>{children}</Suspense>
}
