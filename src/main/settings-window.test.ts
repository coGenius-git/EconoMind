import { EventEmitter } from 'node:events'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ BrowserWindow: {} }))
vi.mock('./ipc-handler-registry', () => ({ ipcMainHandle: vi.fn() }))
import { createSettingsWindowController } from './settings-window'

const fakeWindow = (): EventEmitter & {
  isDestroyed: () => boolean
  isMinimized: () => boolean
  show: () => void
  focus: () => void
  restore: () => void
  close: () => void
  webContents: { send: (...args: unknown[]) => void }
} =>
  Object.assign(new EventEmitter(), {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    close: vi.fn(),
    webContents: { send: vi.fn() }
  })
it('reuses one native window for concurrent requests and only delivers its route to that renderer', async () => {
  const owner = fakeWindow()
  const settings = fakeWindow()
  const createWindow = vi.fn(async () => settings as unknown as BrowserWindow)
  const controller = createSettingsWindowController({
    createWindow,
    resolveWindow: () => owner as unknown as BrowserWindow
  })
  const event = { sender: owner.webContents } as unknown as IpcMainInvokeEvent
  await Promise.all([
    controller.open(event),
    controller.open(event, '{"panel":"specialists","view":{"kind":"list"}}')
  ])
  expect(createWindow).toHaveBeenCalledOnce()
  expect(controller.takeRoute(event)).toBeUndefined()
  expect(
    controller.takeRoute({ sender: settings.webContents } as unknown as IpcMainInvokeEvent)
  ).toContain('specialists')
  vi.mocked(settings.isMinimized).mockReturnValue(true)
  await controller.open(event)
  expect(settings.restore).toHaveBeenCalledOnce()
  expect(createWindow).toHaveBeenCalledOnce()
  settings.emit('closed')
  await controller.open(event)
  expect(createWindow).toHaveBeenCalledTimes(2)
})
it('rejects malformed routes and restricts navigation to the Settings sender', async () => {
  const owner = fakeWindow()
  const settings = fakeWindow()
  const controller = createSettingsWindowController({
    createWindow: async () => settings as unknown as BrowserWindow,
    resolveWindow: () => owner as unknown as BrowserWindow
  })
  const event = { sender: owner.webContents } as unknown as IpcMainInvokeEvent
  await expect(controller.open(event, '{"panel":"arbitrary"}')).rejects.toThrow(
    'Invalid Settings route'
  )
  await controller.open(event)
  controller.navigateMain(event, { kind: 'project', id: 'project-1' })
  expect(owner.webContents.send).not.toHaveBeenCalled()
  controller.navigateMain({ sender: settings.webContents } as unknown as IpcMainInvokeEvent, {
    kind: 'project',
    id: 'project-1'
  })
  expect(owner.webContents.send).toHaveBeenCalledWith('window:settings-navigation', {
    kind: 'project',
    id: 'project-1'
  })
  expect(owner.focus).toHaveBeenCalledOnce()
  for (const kind of [
    'customize-skill',
    'customize-specialist',
    'wsl-support',
    'wsl-create-project'
  ] as const) {
    controller.navigateMain({ sender: settings.webContents } as unknown as IpcMainInvokeEvent, {
      kind,
      id: 'project-1'
    })
    expect(owner.webContents.send).toHaveBeenLastCalledWith('window:settings-navigation', {
      kind,
      id: 'project-1'
    })
  }
  vi.mocked(owner.webContents.send).mockClear()
  controller.navigateMain(
    { sender: settings.webContents } as unknown as IpcMainInvokeEvent,
    {
      kind: 'arbitrary',
      id: 'project-1'
    } as never
  )
  expect(owner.webContents.send).not.toHaveBeenCalled()
})

it('waits for the owning Settings renderer to confirm native close', async () => {
  const owner = fakeWindow()
  const settings = fakeWindow()
  const controller = createSettingsWindowController({
    createWindow: async () => settings as unknown as BrowserWindow,
    resolveWindow: () => owner as unknown as BrowserWindow
  })
  const event = { sender: owner.webContents } as unknown as IpcMainInvokeEvent
  await controller.open(event)
  const closeEvent = { preventDefault: vi.fn() }
  settings.emit('close', closeEvent)
  expect(closeEvent.preventDefault).toHaveBeenCalledOnce()
  expect(settings.webContents.send).toHaveBeenCalledWith('window:settings-close-request')
  controller.confirmClose(event)
  expect(settings.close).not.toHaveBeenCalled()
  controller.confirmClose({ sender: settings.webContents } as unknown as IpcMainInvokeEvent)
  expect(settings.close).toHaveBeenCalledOnce()
  closeEvent.preventDefault.mockClear()
  settings.emit('close', closeEvent)
  expect(closeEvent.preventDefault).not.toHaveBeenCalled()
})
