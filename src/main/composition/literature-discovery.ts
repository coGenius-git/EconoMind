import { app } from 'electron'
import type { ApplicationModuleBuilder } from '../application-runtime'
import { RestrictedInferenceRunner } from '../acp/restricted-inference-runner'
import { LiteratureDiscovery } from '../literature/discovery/discovery-service'
import type { LiteratureCatalog } from '../literature/catalog'
import { createScreeningModel } from '../literature/screening-model'
import { tryDecryptKey } from '../settings/crypto'
import type { SettingsService } from '../settings/service'
import { resolveConfigRoot } from '../storage-root'

// OpenAlex is searched online. CNKI is not: its records arrive as an export file that the user
// produces on the site, so this module owns no browser window and no sign-in state.
export async function composeLiteratureDiscovery({
  settingsService,
  literatureCatalog,
  modules
}: {
  settingsService: SettingsService
  literatureCatalog: LiteratureCatalog
  modules: ApplicationModuleBuilder
}): Promise<LiteratureDiscovery> {
  const inference = new RestrictedInferenceRunner({
    appVersion: app.getVersion(),
    configRoot: resolveConfigRoot(),
    profileNamespace: 'literature-discovery',
    resolveTarget: (target, context) => settingsService.resolveExplicitAgentBackend(target, context)
  })
  const discovery = new LiteratureDiscovery({
    importItems: (inputs, collectionId, duplicatePolicy) =>
      literatureCatalog.importItems(inputs, collectionId ?? undefined, duplicatePolicy),
    get: (itemId) => literatureCatalog.get(itemId),
    model: async () => {
      const target = await settingsService.captureActiveExplicitAgentBackendTarget()
      return createScreeningModel(inference, target)
    },
    openAlexKey: async () =>
      tryDecryptKey((await settingsService.getConnectors())?.openAlexApiKeyRef),
    contactEmail: async () => (await settingsService.getConnectors())?.contactEmail
  })
  await modules.add({ discovery, inference }, ({ discovery: owner, inference: runner }) => ({
    name: 'literature-discovery',
    capability: owner,
    dispose: async () => {
      await runner.shutdown()
    }
  }))
  return discovery
}
