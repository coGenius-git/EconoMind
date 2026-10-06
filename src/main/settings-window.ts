import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { ipcMainHandle } from './ipc-handler-registry'
import { parseSettingsWindowRoute, type SettingsWindowNavigation } from '../shared/settings-window'
import { WINDOWS_TITLEBAR_HEIGHT } from '../shared/window-controls'

type SettingsWindowDeps = {
  createWindow: () => Promise<BrowserWindow>
  resolveWindow: (event: IpcMainInvokeEvent) => BrowserWindow | null
}
type SettingsWindowController = {
  open: (event: IpcMainInvokeEvent, route?: string) => Promise<void>
  takeRoute: (event: IpcMainInvokeEvent) => string | undefined
  navigateMain: (event: IpcMainInvokeEvent, request: SettingsWindowNavigation) => void
  confirmClose: (event: IpcMainInvokeEvent) => void
  isFocused: (event: IpcMainInvokeEvent) => boolean
}

export const createSettingsWindowController = (
  deps: SettingsWindowDeps
): SettingsWindowController => {
  let settingsWindow: BrowserWindow | undefined
  let opening: Promise<BrowserWindow> | undefined
  let owner: BrowserWindow | undefined
  let pendingRoute: string | undefined
  const confirmedCloses = new WeakSet<BrowserWindow>()
  let settingsFocused = false
  const notifyFocus = (focused: boolean): void => {
    if (settingsFocused === focused) return
    settingsFocused = focused
    if (owner && !owner.isDestroyed())
      owner.webContents.send('window:settings-focus-changed', focused)
  }

  return {
    open: async (event: IpcMainInvokeEvent, route?: string): Promise<void> => {
      const source = deps.resolveWindow(event)
      if (!source || source.isDestroyed()) return
      if (route !== undefined && !parseSettingsWindowRoute(route))
        throw new Error('Invalid Settings route')
      if (source !== settingsWindow && source !== owner) {
        notifyFocus(false)
        owner = source
      }
      if (route !== undefined) pendingRoute = route
      if (!settingsWindow || settingsWindow.isDestroyed()) {
        opening ??= deps
          .createWindow()
          .then((window) => {
            settingsWindow = window
            window.on('focus', () => notifyFocus(true))
            window.on('blur', () => notifyFocus(false))
            window.on('hide', () => notifyFocus(false))
            window.on('minimize', () => notifyFocus(false))
            window.webContents.on('render-process-gone', () => notifyFocus(false))
            window.on('close', (closeEvent) => {
              if (confirmedCloses.has(window)) return
              closeEvent.preventDefault()
              window.webContents.send('window:settings-close-request')
            })
            window.on('closed', () => {
              if (settingsWindow !== window) return
              notifyFocus(false)
              settingsWindow = undefined
              pendingRoute = undefined
            })
            return window
          })
          .finally(() => {
            opening = undefined
          })
        await opening
      }
      const window = settingsWindow!
      if (window.isDestroyed()) return
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
      notifyFocus(true)
      if (pendingRoute) window.webContents.send('window:settings-route', pendingRoute)
    },
    isFocused: (event) => event.sender === owner?.webContents && settingsFocused,
    takeRoute: (event: IpcMainInvokeEvent): string | undefined => {
      if (event.sender !== settingsWindow?.webContents) return undefined
      const route = pendingRoute
      pendingRoute = undefined
      return route
    },
    confirmClose: (event: IpcMainInvokeEvent): void => {
      if (!settingsWindow || event.sender !== settingsWindow.webContents) return
      confirmedCloses.add(settingsWindow)
      settingsWindow.close()
    },
    navigateMain: (event: IpcMainInvokeEvent, request: SettingsWindowNavigation): void => {
      if (event.sender !== settingsWindow?.webContents || !owner || owner.isDestroyed()) return
      if (
        !request ||
        ![
          'session',
          'project',
          'literature',
          'customize-skill',
          'customize-specialist',
          'wsl-support',
          'wsl-create-project',
          'product-tour'
        ].includes(request.kind) ||
        typeof request.id !== 'string' ||
        !request.id ||
        request.id.length > 1024
      )
        return
      owner.webContents.send('window:settings-navigation', request)
      if (owner.isMinimized()) owner.restore()
      owner.show()
      owner.focus()
    }
  }
}

export const registerSettingsWindowIpcHandlers = (): void => {
  const controller = createSettingsWindowController({
    resolveWindow: (event) => BrowserWindow.fromWebContents(event.sender),
    createWindow: async () => {
      const { createAppWindow, loadRenderer } = await import('./windows')
      const window = createAppWindow({
        width: 1000,
        height: 780,
        minWidth: 720,
        minHeight: 540,
        title: 'EconoMind',
        modal: false,
        ...(process.platform === 'win32'
          ? {
              titleBarStyle: 'hidden',
              titleBarOverlay: { height: WINDOWS_TITLEBAR_HEIGHT, color: '#00000000' }
            }
          : {})
      })
      window.removeMenu()
      if (process.platform === 'win32') {
        window.on('enter-full-screen', () =>
          window.webContents.send('window:full-screen-changed', true)
        )
        window.on('leave-full-screen', () =>
          window.webContents.send('window:full-screen-changed', false)
        )
      }
      try {
        await loadRenderer(window, { window: 'settings' })
        return window
      } catch (error) {
        window.destroy()
        throw error
      }
    }
  })
  ipcMainHandle('window:open-settings', (event, route?: string) => controller.open(event, route))
  ipcMainHandle('window:take-settings-route', (event) => controller.takeRoute(event))
  ipcMainHandle('window:is-settings-focused', (event) => controller.isFocused(event))
  ipcMainHandle('window:confirm-settings-close', (event) => controller.confirmClose(event))
  ipcMainHandle('window:navigate-main', (event, request: SettingsWindowNavigation) =>
    controller.navigateMain(event, request)
  )
}
