import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawnSync = vi.hoisted(() => vi.fn())
const existsSync = vi.hoisted(() => vi.fn(() => true))
const quitAndInstall = vi.hoisted(() => vi.fn())
const updaterListeners = vi.hoisted(() => new Map<string, (...args: unknown[]) => void>())
const loggerMocks = vi.hoisted(() => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  return { log, createLogger: vi.fn(() => log) }
})

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawnSync
}))
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync
}))
vi.mock('../logger', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../logger')>()),
  createLogger: loggerMocks.createLogger
}))

// createUpdateStrategy constructs a concrete strategy per platform. Both strategies touch native
// modules at construction (UpdateService reads app.getVersion(); ElectronUpdaterStrategy subscribes to
// autoUpdater), so stub them enough to instantiate without a real Electron runtime.
vi.mock('electron', () => ({
  app: {
    getPath: () => '/Applications/EconoMind.app/Contents/MacOS/EconoMind',
    getVersion: () => '0.0.0',
    isPackaged: true
  },
  BrowserWindow: { getAllWindows: () => [] },
  shell: { openExternal: vi.fn(async () => {}), openPath: vi.fn(async () => '') }
}))
vi.mock('electron-updater', () => ({
  AppImageUpdater: class {},
  DebUpdater: class {},
  CancellationToken: class {
    cancelled = false
    cancel(): void {
      this.cancelled = true
    }
  },
  autoUpdater: {
    on: (event: string, listener: (...args: unknown[]) => void) => {
      updaterListeners.set(event, listener)
    },
    downloadUpdate: async () => {
      updaterListeners.get('update-downloaded')?.()
    },
    autoDownload: true,
    autoInstallOnAppQuit: true,
    quitAndInstall
  }
}))

import { createUpdateStrategy } from './create-strategy'
import { ElectronUpdaterStrategy } from './electron-updater-strategy'
import { UpdateService } from './service'

describe('createUpdateStrategy', () => {
  it.each(['win32', 'linux', 'darwin'] as const)(
    'does not enable %s updates from an inherited feed without an EconoMind release service',
    async (platform) => {
      const resources = Object.getOwnPropertyDescriptor(process, 'resourcesPath')
      Object.defineProperty(process, 'resourcesPath', {
        value: '/installed/resources',
        configurable: true
      })
      try {
        const strategy = createUpdateStrategy(platform, { isPackaged: true, version: '0.34.1' })
        for (const method of ['check', 'download', 'apply'] as const) {
          expect(await strategy[method]()).toMatchObject({
            state: 'idle',
            unavailableReason: 'missing-feed'
          })
        }
        expect(updaterListeners.size).toBe(0)
        expect(quitAndInstall).not.toHaveBeenCalled()
      } finally {
        if (resources) Object.defineProperty(process, 'resourcesPath', resources)
        else Reflect.deleteProperty(process, 'resourcesPath')
      }
    }
  )
  it.each(['win32', 'linux', 'darwin'] as const)(
    'reports why updates are unavailable in a %s development build',
    async (platform) => {
      const strategy = createUpdateStrategy(platform, { isPackaged: false, version: '0.34.1' })
      expect(strategy.getStatus()).toMatchObject({
        state: 'idle',
        unavailableReason: 'development-build'
      })
      expect(await strategy.check()).toMatchObject({
        current: '0.34.1',
        unavailableReason: 'development-build'
      })
      expect(updaterListeners.size).toBe(0)
    }
  )

  beforeEach(() => {
    spawnSync.mockReset()
    quitAndInstall.mockReset()
    updaterListeners.clear()
    loggerMocks.createLogger.mockClear()
    for (const log of Object.values(loggerMocks.log)) log.mockClear()
    spawnSync.mockReturnValue({
      status: 0,
      stdout: '',
      stderr: 'Identifier=com.aipoch.open-science\nTeamIdentifier=87G9WFU9H3\n'
    })
  })

  it('uses ElectronUpdaterStrategy on win32', () => {
    expect(createUpdateStrategy('win32', { hasUpdateFeed: true })).toBeInstanceOf(
      ElectronUpdaterStrategy
    )
  })

  it('uses ElectronUpdaterStrategy on linux', () => {
    expect(createUpdateStrategy('linux', { hasUpdateFeed: true })).toBeInstanceOf(
      ElectronUpdaterStrategy
    )
  })

  it.each(['win32', 'linux', 'darwin'] as const)(
    'keeps a packaged %s distribution without a feed offline for every update operation',
    async (platform) => {
      const strategy = createUpdateStrategy(platform, {
        isPackaged: true,
        version: '0.27.0',
        hasUpdateFeed: false
      })
      for (const method of ['getStatus', 'check', 'download', 'cancel', 'apply'] as const) {
        expect(await strategy[method]()).toEqual({
          state: 'idle',
          current: '0.27.0',
          unavailableReason: 'missing-feed'
        })
      }
      expect(updaterListeners.size).toBe(0)
      expect(quitAndInstall).not.toHaveBeenCalled()
      expect(spawnSync).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['in-place', 'win32', { isPackaged: true, hasUpdateFeed: true }],
    ['manifest', 'darwin', { isPackaged: true, hasUpdateFeed: true, version: '1.2.3-nightly' }]
  ] as const)(
    'injects the production update logger into the %s strategy',
    async (_, platform, opts) => {
      const strategy = createUpdateStrategy(platform, opts)
      if (strategy instanceof ElectronUpdaterStrategy) {
        updaterListeners.get('update-available')?.({})
        await strategy.download()
      }

      await strategy.apply()

      expect(loggerMocks.createLogger).toHaveBeenCalledWith('update')
      expect(loggerMocks.log.info).toHaveBeenCalledWith(
        'operation completed',
        expect.objectContaining({ operation: 'update-apply', outcome: 'completed' })
      )
    }
  )

  it('constructs the in-place strategy with its install gate', async () => {
    const installGate = vi.fn(async () => ({ completed: true, reaped: true }))
    const strategy = createUpdateStrategy('win32', { hasUpdateFeed: true, installGate })
    updaterListeners.get('update-available')?.({})
    await strategy.download()

    await strategy.apply()

    expect(installGate).toHaveBeenCalledTimes(1)
    expect(quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('forwards update handoff cleanup to the in-place strategy', async () => {
    const releaseInstallHandoff = vi.fn()
    quitAndInstall.mockImplementationOnce(() => {
      throw new Error('installer unavailable')
    })
    const strategy = createUpdateStrategy('win32', {
      hasUpdateFeed: true,
      installGate: vi.fn(async () => ({ completed: true, reaped: true })),
      releaseInstallHandoff
    })
    updaterListeners.get('update-available')?.({})
    await strategy.download()

    await strategy.apply()

    expect(releaseInstallHandoff).toHaveBeenCalledOnce()
  })

  it('uses ElectronUpdaterStrategy on darwin for a packaged stable build', () => {
    expect(
      createUpdateStrategy('darwin', { isPackaged: true, hasUpdateFeed: true, version: '1.2.3' })
    ).toBeInstanceOf(ElectronUpdaterStrategy)
  })

  it('falls back to the installer on darwin for an ad-hoc-signed packaged stable build', () => {
    spawnSync.mockReturnValueOnce({
      status: 0,
      stdout: '',
      stderr: 'Identifier=com.aipoch.open-science\nSignature=adhoc\nTeamIdentifier=not set\n'
    })

    expect(
      createUpdateStrategy('darwin', { isPackaged: true, hasUpdateFeed: true, version: '1.2.3' })
    ).toBeInstanceOf(UpdateService)
  })

  it('falls back to the installer on darwin for a stable build signed by another team', () => {
    spawnSync.mockReturnValueOnce({
      status: 0,
      stdout: '',
      stderr: 'Identifier=com.aipoch.open-science\nTeamIdentifier=OTHERTEAM1\n'
    })

    expect(
      createUpdateStrategy('darwin', { isPackaged: true, hasUpdateFeed: true, version: '1.2.3' })
    ).toBeInstanceOf(UpdateService)
  })

  it('falls back to the installer on darwin for another app signed by the official team', () => {
    spawnSync.mockReturnValueOnce({
      status: 0,
      stdout: '',
      stderr: 'Identifier=com.aipoch.another-app\nTeamIdentifier=87G9WFU9H3\n'
    })

    expect(
      createUpdateStrategy('darwin', { isPackaged: true, hasUpdateFeed: true, version: '1.2.3' })
    ).toBeInstanceOf(UpdateService)
  })

  it('falls back to the installer when the installed mac signature cannot be read', () => {
    spawnSync.mockReturnValueOnce({
      status: 1,
      stdout: '',
      stderr: 'code object is not signed at all'
    })

    expect(
      createUpdateStrategy('darwin', { isPackaged: true, hasUpdateFeed: true, version: '1.2.3' })
    ).toBeInstanceOf(UpdateService)
  })

  it('falls back to UpdateService on darwin for a nightly (prerelease) build', () => {
    expect(
      createUpdateStrategy('darwin', {
        isPackaged: true,
        hasUpdateFeed: true,
        version: '1.2.3-nightly.abc1234'
      })
    ).toBeInstanceOf(UpdateService)
  })

  it('keeps an unpackaged macOS build offline even when a feed was supplied', () => {
    expect(
      createUpdateStrategy('darwin', {
        isPackaged: false,
        hasUpdateFeed: true,
        version: '1.2.3'
      }).getStatus()
    ).toMatchObject({ state: 'idle', unavailableReason: 'development-build' })
  })
})
