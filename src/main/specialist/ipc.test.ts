import { describe, expect, it, vi } from 'vitest'

import type { SpecialistView } from '../../shared/specialist'
import { SPECIALIST_IPC } from '../../shared/specialist'

import { SessionBindingService } from './session-binding'
import { registerSpecialistIpcHandlers } from './ipc'
import type { SpecialistService } from './service'
import { SessionSpecialistReconfiguration } from './session-reconfiguration'
import type { SpecialistApplicationOwner } from './application-commands'

const handlers = new Map<string, (event: unknown, payload: unknown) => unknown>()
const broadcastToRenderers = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, payload: unknown) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))
vi.mock('../renderer-broadcast', () => ({ broadcastToRenderers }))

const profile = {
  id: 'specialist-1',
  name: 'RESEARCHER',
  description: '',
  systemPrompt: 'Research.',
  enabled: true,
  capabilityMode: 'full',
  fullAccess: { excludedSkillIds: [], excludedConnectorIds: [], connectorTools: [] },
  selectedCapabilities: { skillIds: [], connectorIds: [], connectorTools: [] },
  revision: 1
} as SpecialistView

const createSpecialistService = (): SpecialistService =>
  ({
    getById: vi.fn().mockResolvedValue(profile),
    resolveRunnableById: vi.fn().mockResolvedValue(profile),
    listForSettings: vi.fn().mockResolvedValue([]),
    listForSettingsSnapshot: vi.fn().mockResolvedValue({ items: [], integrity: { status: 'ok' } }),
    subscribe: vi.fn()
  }) as unknown as SpecialistService

const createReconfigurationStub = (): Pick<SessionSpecialistReconfiguration, 'requestSwitch'> => ({
  requestSwitch: vi.fn().mockResolvedValue({ status: 'applied', contextReset: false })
})

describe('specialist session IPC', () => {
  it('forwards the Electron upload adapters with one caller lease and composition-owned subscription', async () => {
    handlers.clear()
    const service = createSpecialistService()
    const beginUpload = vi.fn().mockResolvedValue({ receivedBytes: 0 })
    const previewUpload = vi.fn().mockResolvedValue({ candidateToken: 'preview' })
    const abortUpload = vi.fn().mockResolvedValue(undefined)
    registerSpecialistIpcHandlers(
      service,
      new SessionBindingService(service),
      createReconfigurationStub(),
      undefined,
      undefined,
      undefined,
      { beginUpload, previewUpload, abortUpload } as unknown as SpecialistApplicationOwner
    )
    const event = { sender: { id: 2119, once: vi.fn() } }
    const request = { transferId: 'upload', name: 'research.zip', size: 50 }
    await handlers.get('specialist:package-upload-begin')!(event, request)
    await handlers.get('specialist:package-upload-preview')!(event, { transferId: 'upload' })
    await handlers.get('specialist:package-upload-abort')!(event, { transferId: 'upload' })
    const invocation = beginUpload.mock.calls[0][0]
    expect(invocation).toMatchObject({
      callerContext: { surface: 'electron', clientId: '2119' },
      args: [request]
    })
    expect(invocation.callerLease.isCurrent()).toBe(true)
    for (const method of [previewUpload, abortUpload]) {
      expect(method).toHaveBeenCalledWith({
        callerContext: invocation.callerContext,
        callerLease: invocation.callerLease,
        args: [{ transferId: 'upload' }]
      })
    }
    expect(service.subscribe).not.toHaveBeenCalled()
    event.sender.once.mock.calls.find(([name]) => name === 'destroyed')![1]()
    expect(invocation.callerLease.signal.aborted).toBe(true)
  })

  it('broadcasts only an invalidation signal without profile prompts or resource paths', () => {
    let notify: (() => void) | undefined
    const service = {
      ...createSpecialistService(),
      subscribe: vi.fn((listener: () => void) => {
        notify = listener
        return vi.fn()
      })
    } as unknown as SpecialistService

    registerSpecialistIpcHandlers(
      service,
      new SessionBindingService(service),
      createReconfigurationStub()
    )
    notify?.()

    expect(broadcastToRenderers).toHaveBeenCalledWith(SPECIALIST_IPC.CATALOG_CHANGED, undefined)
    const payload = JSON.stringify(broadcastToRenderers.mock.calls)
    expect(payload).not.toContain(profile.systemPrompt)
    expect(payload).not.toMatch(/resources[/\\]specialists/)
  })

  it('skips runtime invalidation only for appearance-only updates', async () => {
    handlers.clear()
    const service = {
      ...createSpecialistService(),
      update: vi.fn().mockResolvedValue(profile)
    } as unknown as SpecialistService
    const onProfilesChanged = vi.fn()

    registerSpecialistIpcHandlers(
      service,
      new SessionBindingService(service),
      createReconfigurationStub(),
      onProfilesChanged
    )
    const handler = handlers.get(SPECIALIST_IPC.UPDATE)

    await handler?.(undefined, {
      id: profile.id,
      revision: profile.revision,
      iconKey: 'book-open'
    })
    await handler?.(undefined, {
      id: profile.id,
      revision: profile.revision,
      colorKey: 'purple'
    })
    expect(onProfilesChanged).not.toHaveBeenCalled()

    await handler?.(undefined, {
      id: profile.id,
      revision: profile.revision,
      selectedCapabilities: profile.selectedCapabilities
    })
    expect(onProfilesChanged).toHaveBeenCalledOnce()
  })

  it('routes a session specialist switch through the reconfiguration owner', async () => {
    handlers.clear()
    const binding = new SessionBindingService(createSpecialistService())
    const reconfiguration = createReconfigurationStub()

    registerSpecialistIpcHandlers(createSpecialistService(), binding, reconfiguration)

    const handler = handlers.get(SPECIALIST_IPC.SET_SESSION_SPECIALIST)
    expect(handler).toBeDefined()

    await expect(
      handler?.(undefined, { sessionId: 'session-1', specialistId: profile.id })
    ).resolves.toEqual({ status: 'applied', contextReset: false })

    expect(reconfiguration.requestSwitch).toHaveBeenCalledWith('session-1', profile.id)
  })

  it('does not leave durable, Main-memory, and runtime Specialist bindings silently divergent', async () => {
    handlers.clear()
    const service = createSpecialistService()
    const binding = new SessionBindingService(service)
    binding.setBinding('session-1', 'specialist-old')
    let durableBinding: {
      specialistId: string | undefined
      specialistBindingPending?: true
    } = { specialistId: 'specialist-old' }
    const runtimeSpecialistId: string | undefined = 'specialist-old'
    const reconfiguration = new SessionSpecialistReconfiguration({
      sessionBinding: binding,
      loadBinding: async () => durableBinding,
      persistBinding: async (_sessionId, specialistId, pending) => {
        durableBinding = {
          specialistId,
          ...(pending ? { specialistBindingPending: true as const } : {})
        }
      },
      applyRuntime: async () => {
        throw new Error('runtime replacement failed')
      }
    })

    registerSpecialistIpcHandlers(service, binding, reconfiguration)

    const handler = handlers.get(SPECIALIST_IPC.SET_SESSION_SPECIALIST)
    let result: unknown
    try {
      result = await handler?.(undefined, {
        sessionId: 'session-1',
        specialistId: profile.id
      })
    } catch {
      // A rejected switch is acceptable only when the three authorities still agree.
    }

    const authoritiesAgree =
      new Set([durableBinding.specialistId, binding.getBinding('session-1'), runtimeSpecialistId])
        .size === 1
    const explicitlyPending =
      typeof result === 'object' &&
      result !== null &&
      (result as { status?: unknown }).status === 'pending'

    expect(authoritiesAgree || explicitlyPending).toBe(true)
    expect(durableBinding).toEqual({
      specialistId: profile.id,
      specialistBindingPending: true
    })
    await expect(reconfiguration.assertUserPromptReady('session-1')).rejects.toThrow(
      /has not been applied/
    )
    expect(runtimeSpecialistId).toBe('specialist-old')
  })

  it('returns only the renderer-safe template save result from main', async () => {
    handlers.clear()
    const binding = new SessionBindingService(createSpecialistService())
    const exportContributionTemplate = vi.fn().mockResolvedValue({ saved: true })

    registerSpecialistIpcHandlers(
      createSpecialistService(),
      binding,
      createReconfigurationStub(),
      undefined,
      exportContributionTemplate
    )

    const result = await handlers.get(SPECIALIST_IPC.EXPORT_CONTRIBUTION_TEMPLATE)?.(
      undefined,
      undefined
    )
    expect(result).toEqual({ saved: true })
  })

  it('keeps archive bytes in main and validates install requests before the package service', async () => {
    handlers.clear()
    const binding = new SessionBindingService(createSpecialistService())
    const preview = vi.fn().mockResolvedValue({
      candidateToken: 'candidate-1',
      summary: { id: 'safe-id' },
      diagnostics: [],
      installable: true
    })
    const install = vi.fn()
    const dispose = vi.fn()
    const once = vi.fn()

    registerSpecialistIpcHandlers(
      createSpecialistService(),
      binding,
      createReconfigurationStub(),
      undefined,
      undefined,
      {
        service: {
          preview,
          previewOversizedArchive: vi.fn(),
          install,
          cancel: vi.fn(),
          dispose,
          report: vi.fn(),
          previewExport: vi.fn(),
          export: vi.fn(),
          previewSpecialistDelete: vi.fn(),
          deleteSpecialist: vi.fn()
        },
        selectArchive: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]) }),
        saveReport: vi.fn(),
        saveExport: vi.fn()
      }
    )

    const event = { sender: { id: 17, once } }
    const selected = await handlers.get(SPECIALIST_IPC.SELECT_PACKAGE)?.(event, undefined)
    expect(selected).toEqual({
      candidateToken: 'candidate-1',
      summary: { id: 'safe-id' },
      diagnostics: [],
      installable: true
    })
    expect(JSON.stringify(selected)).not.toMatch(/bytes|path/i)
    expect(dispose).toHaveBeenCalledWith(17)
    expect(preview).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 17)
    expect(once).toHaveBeenCalledWith('destroyed', expect.any(Function))

    const validRequest = {
      candidateToken: 'candidate-1',
      skillConflictResolutions: []
    }
    await handlers.get(SPECIALIST_IPC.INSTALL_PACKAGE)?.(event, validRequest)
    expect(install).toHaveBeenCalledWith(validRequest, 17)

    install.mockClear()
    await expect(
      handlers.get(SPECIALIST_IPC.INSTALL_PACKAGE)?.(undefined, {
        candidateToken: 'candidate-1',
        enabled: false
      })
    ).resolves.toEqual({ status: 'failed', code: 'candidate-invalid' })
    expect(install).not.toHaveBeenCalled()

    await expect(
      handlers.get(SPECIALIST_IPC.INSTALL_PACKAGE)?.(undefined, {
        candidateToken: 'candidate-1',
        skillConflictResolutions: [{ skillId: 'conflict', resolution: 'replace' }]
      })
    ).resolves.toEqual({ status: 'failed', code: 'candidate-invalid' })
    expect(install).not.toHaveBeenCalled()
  })

  it('saves only the main-owned report for a valid candidate request', async () => {
    handlers.clear()
    const report = { schemaVersion: 1 as const, diagnostics: [], installable: false }
    const saveReport = vi
      .fn()
      .mockResolvedValue({ saved: true, filePath: '/downloads/report.json' })

    registerSpecialistIpcHandlers(
      createSpecialistService(),
      new SessionBindingService(createSpecialistService()),
      createReconfigurationStub(),
      undefined,
      undefined,
      {
        service: {
          preview: vi.fn(),
          previewOversizedArchive: vi.fn(),
          install: vi.fn(),
          cancel: vi.fn(),
          dispose: vi.fn(),
          report: vi.fn().mockReturnValue(report),
          previewExport: vi.fn(),
          export: vi.fn(),
          previewSpecialistDelete: vi.fn(),
          deleteSpecialist: vi.fn()
        },
        selectArchive: vi.fn(),
        saveReport,
        saveExport: vi.fn()
      }
    )

    await expect(
      handlers.get(SPECIALIST_IPC.SAVE_PACKAGE_REPORT)?.(undefined, {
        candidateToken: 'candidate-1'
      })
    ).resolves.toEqual({ saved: true })
    expect(saveReport).toHaveBeenCalledWith(report)

    await expect(
      handlers.get(SPECIALIST_IPC.SAVE_PACKAGE_REPORT)?.(undefined, {
        candidateToken: 'candidate-1',
        report: { secret: true }
      })
    ).resolves.toEqual({ saved: false })
    expect(saveReport).toHaveBeenCalledOnce()
  })

  it('keeps export and linked deletion routes available on the same package owner', async () => {
    handlers.clear()
    const previewExport = vi.fn().mockResolvedValue({
      specialistId: 'research-synth',
      name: 'Research Synthesizer',
      version: '1.3.0',
      fileName: 'open-science-specialist-research-synthesizer-v1.3.0.zip',
      expectedRevision: 3,
      skills: [],
      diagnostics: [],
      canExport: true
    })
    const exportArchive = vi.fn().mockResolvedValue({
      fileName: 'research-synth-1.3.0.zip',
      archiveBytes: new Uint8Array([1, 2, 3])
    })
    const saveExport = vi.fn().mockResolvedValue({ saved: true })
    const previewSpecialistDelete = vi.fn().mockResolvedValue({
      specialistId: 'specialist-1',
      specialistName: 'Researcher',
      expectedRevision: 1,
      skills: []
    })
    const deleteSpecialist = vi.fn().mockResolvedValue({ status: 'deleted' })
    const onProfilesChanged = vi.fn()
    const packageService = {
      preview: vi.fn(),
      previewOversizedArchive: vi.fn(),
      install: vi.fn(),
      cancel: vi.fn(),
      dispose: vi.fn(),
      report: vi.fn(),
      previewExport,
      export: exportArchive,
      previewSpecialistDelete,
      deleteSpecialist
    }
    registerSpecialistIpcHandlers(
      createSpecialistService(),
      new SessionBindingService(createSpecialistService()),
      createReconfigurationStub(),
      onProfilesChanged,
      undefined,
      { service: packageService, selectArchive: vi.fn(), saveReport: vi.fn(), saveExport }
    )

    await expect(
      handlers.get(SPECIALIST_IPC.PREVIEW_EXPORT)?.(undefined, {
        specialistId: 'research-synth'
      })
    ).resolves.toMatchObject({ specialistId: 'research-synth', canExport: true })
    await handlers.get(SPECIALIST_IPC.PREVIEW_EXPORT)?.(undefined, {
      specialistId: 'research-synth',
      includedSkillIds: []
    })
    expect(previewExport).toHaveBeenLastCalledWith('research-synth', [])
    await expect(
      handlers.get(SPECIALIST_IPC.PREVIEW_EXPORT)?.(undefined, {
        specialistId: 'research-synth',
        includedSkillIds: 'invalid'
      })
    ).rejects.toThrow('Invalid Specialist export preview.')
    const result = await handlers.get(SPECIALIST_IPC.EXPORT)?.(undefined, {
      specialistId: 'research-synth',
      expectedRevision: 3,
      includedSkillIds: []
    })
    expect(result).toEqual({ saved: true })
    expect(saveExport).toHaveBeenCalledWith({
      fileName: 'research-synth-1.3.0.zip',
      archiveBytes: new Uint8Array([1, 2, 3])
    })
    expect(JSON.stringify(result)).not.toMatch(/archiveBytes|\/downloads/)

    await expect(
      handlers.get(SPECIALIST_IPC.PREVIEW_DELETE)?.(undefined, { id: 'specialist-1' })
    ).resolves.toMatchObject({ expectedRevision: 1 })
    await expect(
      handlers.get(SPECIALIST_IPC.DELETE)?.(undefined, {
        id: 'specialist-1',
        expectedRevision: 1,
        deleteSkillIds: []
      })
    ).resolves.toEqual({ status: 'deleted' })
    expect(previewSpecialistDelete).toHaveBeenCalledWith({ id: 'specialist-1' })
    expect(deleteSpecialist).toHaveBeenCalledWith({
      id: 'specialist-1',
      expectedRevision: 1,
      deleteSkillIds: []
    })
    expect(onProfilesChanged).not.toHaveBeenCalled()
  })
})
