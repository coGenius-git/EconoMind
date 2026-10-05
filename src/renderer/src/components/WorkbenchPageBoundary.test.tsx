// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { lazy, useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  preload: vi.fn().mockResolvedValue(undefined),
  goHome: vi.fn(),
  openLibrary: vi.fn(),
  openProject: vi.fn()
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (text: string) => text }) }))
vi.mock('@/lib/workbench-page-loaders', () => ({ preloadWorkbenchPage: mocks.preload }))
vi.mock('@/stores/navigation-store', () => ({
  useNavigationStore: Object.assign(
    <T,>(selector: (state: { activeProjectId: string | undefined }) => T): T =>
      selector({ activeProjectId: 'project-1' }),
    { getState: () => ({ ...mocks, activeProjectId: 'project-1' }) }
  )
}))
vi.mock('@/stores/project-store', () => ({
  useProjectStore: { getState: () => ({ projects: [] }) }
}))
vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: { getState: () => ({ openSettings: vi.fn() }) }
}))

import { RetainedWorkspacePage, WorkbenchPageBoundary } from './WorkbenchPageBoundary'
import { ResearchWorkbenchHeader } from './ResearchWorkbenchHeader'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('workbench navigation loading', () => {
  it('retains a visited workspace DOM and draft while stopping hidden page effects', async () => {
    const start = vi.fn()
    const stop = vi.fn()
    const Page = ({ projectId }: { projectId: string | undefined }): React.JSX.Element => {
      useEffect(() => {
        start()
        return stop
      }, [])
      return (
        <main data-project={projectId}>
          <input aria-label="Draft" defaultValue="" />
        </main>
      )
    }
    const screenFor = (active: boolean): React.JSX.Element => (
      <RetainedWorkspacePage active={active}>
        {(projectId) => <Page projectId={projectId} />}
      </RetainedWorkspacePage>
    )
    const { rerender, container } = render(screenFor(false))
    expect(container.querySelector('main')).toBeNull()
    expect(start).not.toHaveBeenCalled()
    rerender(screenFor(true))
    const main = container.querySelector('main')!
    const draft = screen.getByRole('textbox', { name: 'Draft' }) as HTMLInputElement
    fireEvent.change(draft, { target: { value: 'Retained research' } })
    rerender(screenFor(false))
    expect(main.style.display).toBe('none')
    expect(stop).toHaveBeenCalledOnce()
    expect(container.querySelector('main')).toBe(main)
    rerender(screenFor(true))
    expect(container.querySelector('main')).toBe(main)
    expect(draft.value).toBe('Retained research')
    expect(main.dataset.project).toBe('project-1')
    expect(start).toHaveBeenCalledTimes(2)
  })
  it('keeps module navigation visible and usable while the target code is still loading', async () => {
    let resolvePage!: (page: { default: () => React.JSX.Element }) => void
    const Page = lazy(
      () =>
        new Promise<{ default: () => React.JSX.Element }>((resolve) => {
          resolvePage = resolve
        })
    )
    render(
      <WorkbenchPageBoundary view="library">
        <Page />
      </WorkbenchPageBoundary>
    )
    expect(screen.getByRole('status').textContent).toContain('Loading…')
    expect(screen.getByRole('button', { name: 'Library' }).getAttribute('aria-current')).toBe(
      'page'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Research home' }))
    expect(mocks.goHome).toHaveBeenCalledWith('user')
    fireEvent.click(screen.getByRole('button', { name: 'Research workspace' }))
    expect(mocks.openProject).toHaveBeenCalledWith('project-1', 'user')
    await act(async () => resolvePage({ default: () => <main>Library ready</main> }))
    expect(screen.getByText('Library ready')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('starts loading on pointer intent and keyboard focus before navigation', () => {
    const navigate = vi.fn()
    render(
      <ResearchWorkbenchHeader
        active="home"
        onHome={vi.fn()}
        onLibrary={navigate}
        onAnalysis={navigate}
        onSettings={vi.fn()}
      />
    )
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Library' }))
    expect(mocks.preload).toHaveBeenCalledWith('library')
    fireEvent.focus(screen.getByRole('button', { name: 'Research workspace' }))
    expect(mocks.preload).toHaveBeenCalledWith('workspace')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('warms modules one at a time after paint and cancels scheduled work on unmount', async () => {
    const callbacks = new Map<number, IdleRequestCallback>()
    const requestIdle = vi.fn((callback: IdleRequestCallback) => {
      const id = callbacks.size + 1
      callbacks.set(id, callback)
      return id
    })
    const cancelIdle = vi.fn()
    vi.stubGlobal('requestIdleCallback', requestIdle)
    vi.stubGlobal('cancelIdleCallback', cancelIdle)
    const { unmount } = render(
      <WorkbenchPageBoundary view="home">
        <main>Home</main>
      </WorkbenchPageBoundary>
    )
    expect(mocks.preload).not.toHaveBeenCalled()
    await act(async () => callbacks.get(1)!({} as IdleDeadline))
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith('library')
    expect(requestIdle).toHaveBeenCalledTimes(2)
    unmount()
    expect(cancelIdle).toHaveBeenCalledWith(2)
    await act(async () => callbacks.get(2)!({} as IdleDeadline))
    expect(mocks.preload).toHaveBeenCalledTimes(1)
  })
})
