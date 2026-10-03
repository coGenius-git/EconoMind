import { app } from 'electron'
import { join } from 'node:path'
import type { ApplicationModuleBuilder } from '../application-runtime'
import { RestrictedInferenceRunner } from '../acp/restricted-inference-runner'
import type { LiteratureAttachmentAuthority } from '../literature/attachment-authority'
import type { LiteratureCatalog } from '../literature/catalog'
import { createScreeningModel } from '../literature/screening-model'
import { parseScreeningPdf } from '../literature/screening-pdf-parser'
import { LiteratureScreeningWorkflows } from '../literature/screening-workflows'
import { createLogger, errorLogFields } from '../logger'
import type { SettingsService } from '../settings/service'
import { resolveConfigRoot, resolveDataRoot } from '../storage-root'
import { acquireDataRootWriter, withDataRootWrite } from '../storage/migration-state'

// Keep the EconoMind screening workflow on the same storage and lifecycle owners as the new
// research catalog. Smart collections and the report-producing workflow remain separate services.
export async function composeLiteratureScreening({
  settingsService,
  literatureCatalog,
  literatureAttachmentAuthority,
  getProjectName,
  modules
}: {
  settingsService: SettingsService
  literatureCatalog: LiteratureCatalog
  literatureAttachmentAuthority: LiteratureAttachmentAuthority
  getProjectName: (id: string) => Promise<string | undefined>
  modules: ApplicationModuleBuilder
}): Promise<LiteratureScreeningWorkflows> {
  const inference = new RestrictedInferenceRunner({
    appVersion: app.getVersion(),
    configRoot: resolveConfigRoot(),
    profileNamespace: 'literature-screening',
    resolveTarget: (target, context) => settingsService.resolveExplicitAgentBackend(target, context)
  })
  const workflows = new LiteratureScreeningWorkflows({
    root: join(resolveDataRoot(), 'literature', 'screening-workflows'),
    getProjectName,
    runWorker: async (work) => {
      const release = acquireDataRootWriter()
      try {
        await withDataRootWrite(work)
      } finally {
        release()
      }
    },
    reportError: (error) =>
      createLogger('literature:screening').error('Screening worker failed', errorLogFields(error)),
    getItem: (id) => literatureCatalog.get(id),
    parse: (versionId, signal) =>
      parseScreeningPdf(literatureAttachmentAuthority, versionId, signal),
    model: async () => {
      const target = await settingsService.captureActiveExplicitAgentBackendTarget()
      return createScreeningModel(inference, target)
    }
  })
  await modules.add({ workflows, inference }, (owner) => ({
    name: 'literature-screening',
    capability: owner.workflows,
    dispose: async () => {
      await owner.workflows.close()
      await owner.inference.shutdown()
    }
  }))
  return workflows
}
