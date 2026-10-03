import type {
  ContributionTemplateExportResult,
  SpecialistPackageReportSaveResult,
  SpecialistExportPreview,
  SpecialistExportRequest,
  SpecialistExportSaveResult
} from '../specialist-package'

import type {
  BeginUploadTransferRequest,
  UploadTransferRequest,
  UploadTransferStatus
} from '../uploads'

import type {
  CreateSpecialistRequest,
  UpdateSpecialistRequest,
  SetSpecialistEnabledRequest,
  DuplicateSpecialistRequest,
  SpecialistCatalogSnapshot,
  SpecialistView,
  SetSessionSpecialistRequest,
  SetSessionSpecialistResponse,
  ResolveSessionSpecialistRequest,
  SessionSpecialistResolution,
  PendingSwitchBroadcast,
  CompletionHandoffLifecycleEvent,
  CompletionHandoffCommand
} from '../specialist'

import type {
  SpecialistPackageCandidatePreview,
  SpecialistPackageInstallRequest,
  SpecialistPackageInstallResult,
  SpecialistDeletePreview,
  SpecialistDeleteRequest,
  SpecialistDeleteResult
} from '../specialist-package'

import {
  callable,
  ELECTRON,
  WEB,
  type RemoveListener,
  EVENT,
  type AcpListener,
  ELECTRON_EVENT
} from './definition'

export const contracts = {
  'specialist.beginPackageUpload': callable<
    (request: BeginUploadTransferRequest) => Promise<UploadTransferStatus>
  >()('specialist', ['specialist:package-upload-begin']),
  'specialist.previewPackageUpload': callable<
    (request: UploadTransferRequest) => Promise<SpecialistPackageCandidatePreview>
  >()('specialist', ['specialist:package-upload-preview']),
  'specialist.abortPackageUpload': callable<(request: UploadTransferRequest) => Promise<void>>()(
    'specialist',
    ['specialist:package-upload-abort']
  ),
  'specialist.cancelHandoff': callable<(request: CompletionHandoffCommand) => Promise<void>>()(
    'specialist',
    ['specialist:cancel-handoff', ELECTRON]
  ),

  'specialist.cancelPackage': callable<
    (request: SpecialistPackageInstallRequest) => Promise<void>
  >()('specialist', ['specialist:package-cancel', WEB]),
  'specialist.create': callable<(request: CreateSpecialistRequest) => Promise<SpecialistView>>()(
    'specialist',
    ['specialist:create', ELECTRON]
  ),
  'specialist.delete': callable<
    (request: SpecialistDeleteRequest) => Promise<SpecialistDeleteResult>
  >()('specialist', ['specialist:delete', ELECTRON]),
  'specialist.duplicate': callable<
    (request: DuplicateSpecialistRequest) => Promise<CreateSpecialistRequest>
  >()('specialist', ['specialist:duplicate', ELECTRON]),
  'specialist.exportContributionTemplate': callable<
    () => Promise<ContributionTemplateExportResult>
  >()('specialist', ['specialist:export-contribution-template', ELECTRON]),
  'specialist.exportSpecialist': callable<
    (request: SpecialistExportRequest) => Promise<SpecialistExportSaveResult>
  >()('specialist', ['specialist:export-save', ELECTRON]),
  'specialist.getHandoffEvents': callable<
    (sessionId: string) => Promise<CompletionHandoffLifecycleEvent[]>
  >()('specialist', ['specialist:get-handoff-events', ELECTRON]),

  'specialist.installPackage': callable<
    (request: SpecialistPackageInstallRequest) => Promise<SpecialistPackageInstallResult>
  >()('specialist', ['specialist:package-install', WEB]),
  'specialist.list': callable<() => Promise<SpecialistCatalogSnapshot>>()('specialist', [
    'specialist:list',
    WEB
  ]),

  'specialist.onCatalogChanged': callable<(listener: () => void) => RemoveListener>()(
    'specialist',
    ['specialist:catalog-changed', EVENT]
  ),
  'specialist.onHandoffLifecycleEvent': callable<
    (listener: AcpListener<CompletionHandoffLifecycleEvent>) => RemoveListener
  >()('specialist', ['specialist:handoff-lifecycle-changed', ELECTRON_EVENT]),

  'specialist.onPendingSwitch': callable<
    (listener: AcpListener<PendingSwitchBroadcast>) => RemoveListener
  >()('specialist', ['specialist:pending-switch', ELECTRON_EVENT]),

  'specialist.previewDelete': callable<
    (request: { id: string }) => Promise<SpecialistDeletePreview>
  >()('specialist', ['specialist:delete-preview', ELECTRON]),
  'specialist.previewExport': callable<
    (request: {
      specialistId: string
      includedSkillIds?: readonly string[]
    }) => Promise<SpecialistExportPreview>
  >()('specialist', ['specialist:export-preview', ELECTRON]),

  'specialist.resolveSessionSpecialist': callable<
    (request: ResolveSessionSpecialistRequest) => Promise<SessionSpecialistResolution>
  >()('specialist', ['specialist:resolve-session-specialist', ELECTRON]),
  'specialist.retryHandoff': callable<(request: CompletionHandoffCommand) => Promise<unknown>>()(
    'specialist',
    ['specialist:retry-handoff', ELECTRON]
  ),
  'specialist.savePackageReport': callable<
    (request: SpecialistPackageInstallRequest) => Promise<SpecialistPackageReportSaveResult>
  >()('specialist', ['specialist:package-report-save', ELECTRON]),
  'specialist.selectPackage': callable<
    () => Promise<{ cancelled: true } | SpecialistPackageCandidatePreview>
  >()('specialist', ['specialist:package-select', ELECTRON]),
  'specialist.setEnabled': callable<
    (request: SetSpecialistEnabledRequest) => Promise<SpecialistView>
  >()('specialist', ['specialist:set-enabled', WEB]),
  'specialist.setSessionSpecialist': callable<
    (request: SetSessionSpecialistRequest) => Promise<SetSessionSpecialistResponse>
  >()('specialist', ['specialist:set-session-specialist', ELECTRON]),
  'specialist.update': callable<(request: UpdateSpecialistRequest) => Promise<SpecialistView>>()(
    'specialist',
    ['specialist:update', WEB]
  )
} as const
