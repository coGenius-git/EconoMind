// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { i18next } from '@/i18n'
import type { SettingsPage } from './SettingsPage'
import { SettingsWindow } from './SettingsWindow'

vi.mock('@/hooks/useApplicationStartup', () => ({
  useApplicationStartup: () => ({ settings: { isLoaded: true }, sessions: {} })
}))
vi.mock('@/components/PermissionUndoSnackbar', () => ({ PermissionUndoSnackbar: () => null }))
vi.mock('./SettingsPage', () => ({
  SettingsPage: ({ onStartTour, startTourError }: ComponentProps<typeof SettingsPage>) => (
    <>
      <button onClick={onStartTour}>Restart new user guide</button>
      {startTourError ? <div role="alert">Guide restart failed</div> : null}
    </>
  )
}))

const navigateMain = vi.fn()
const confirmSettingsClose = vi.fn()

beforeEach(async () => {
  vi.resetAllMocks()
  navigateMain.mockResolvedValue(undefined)
  confirmSettingsClose.mockResolvedValue(undefined)
  window.api = {
    window: { navigateMain, confirmSettingsClose },
    settings: {}
  } as unknown as typeof window.api
  await i18next.changeLanguage('en')
})

afterEach(cleanup)

it('waits for the main window to accept the replay before closing native Settings', async () => {
  let accept: () => void = () => {}
  navigateMain.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        accept = resolve
      })
  )
  render(<SettingsWindow />)
  const restart = screen.getByRole('button', { name: 'Restart new user guide' })
  fireEvent.click(restart)
  fireEvent.click(restart)
  expect(navigateMain).toHaveBeenCalledExactlyOnceWith({ kind: 'product-tour', id: 'restart' })
  expect(confirmSettingsClose).not.toHaveBeenCalled()
  await act(async () => accept())
  expect(confirmSettingsClose).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).toBeNull()
})

it.each(['navigation', 'close', 'missing bridge'])(
  'reports %s failure and permits another attempt',
  async (failure) => {
    if (failure === 'navigation') navigateMain.mockRejectedValueOnce(new Error('IPC unavailable'))
    else if (failure === 'close')
      confirmSettingsClose.mockRejectedValueOnce(new Error('Close unavailable'))
    else window.api.window.navigateMain = undefined
    render(<SettingsWindow />)
    const restart = screen.getByRole('button', { name: 'Restart new user guide' })
    fireEvent.click(restart)
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    if (failure !== 'close') expect(confirmSettingsClose).not.toHaveBeenCalled()
    window.api.window.navigateMain = navigateMain
    fireEvent.click(restart)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    await waitFor(() =>
      expect(confirmSettingsClose).toHaveBeenCalledTimes(failure === 'close' ? 2 : 1)
    )
  }
)
