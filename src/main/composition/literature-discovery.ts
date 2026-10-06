import { app } from 'electron'
import type { ApplicationModuleBuilder } from '../application-runtime'
import { RestrictedInferenceRunner } from '../acp/restricted-inference-runner'
import { LiteratureDiscovery } from '../literature/discovery/discovery-service'
import type { CnkiSignInState } from '../literature/discovery/cnki-browser'
import type { LiteratureCatalog } from '../literature/catalog'
import { createScreeningModel } from '../literature/screening-model'
import { tryDecryptKey } from '../settings/crypto'
import type { SettingsService } from '../settings/service'
import { resolveConfigRoot } from '../storage-root'
import type { LiteratureFullTextFinder } from '../literature/full-text-finder'
import { netFetchStandard } from '../skills/net-fetch'

// OpenAlex is queried through its API. CNKI is driven by a standalone Chromium that the user
// signs in to once; the profile lives under the data root and is reused for later searches.
// An exported reference file remains a second way to bring CNKI records in.
export type LiteratureDiscoveryCapability = {
  discovery: LiteratureDiscovery
  signInCnki: () => Promise<CnkiSignInState>
  signOutCnki: () => Promise<CnkiSignInState>
  getCnkiState: () => Promise<CnkiSignInState>
}

export async function composeLiteratureDiscovery({
  settingsService,
  literatureCatalog,
  literatureFullTextFinder,
  modules
}: {
  settingsService: SettingsService
  literatureCatalog: LiteratureCatalog
  literatureFullTextFinder: LiteratureFullTextFinder
  modules: ApplicationModuleBuilder
}): Promise<LiteratureDiscoveryCapability> {
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
    fetch: netFetchStandard,
    acquirePdf: (itemId, candidate) =>
      literatureFullTextFinder.acquire(
        itemId,
        [
          ...new Set([
            ...(candidate.openAccessPdfUrls ?? []),
            ...(candidate.openAccessPdfUrl ? [candidate.openAccessPdfUrl] : [])
          ])
        ].map((url) => ({
          url,
          provider: 'openalex',
          source: 'OpenAlex',
          sourceUrl: candidate.url || undefined
        }))
      ),
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
  return {
    discovery,
    signInCnki: () => discovery.signInCnki(),
    signOutCnki: () => discovery.signOutCnki(),
    getCnkiState: () => discovery.getCnkiSignInState()
  }
}
