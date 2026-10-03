import { app } from 'electron'
import type { ApplicationModuleBuilder } from '../application-runtime'
import { RestrictedInferenceRunner } from '../acp/restricted-inference-runner'
import { LiteratureDiscovery } from '../literature/discovery/discovery-service'
import {
  disposeCnkiSession,
  getCnkiSignInState,
  openCnkiSignIn,
  signOutCnki,
  type CnkiSignInState
} from '../literature/discovery/cnki-session'
import type { LiteratureCatalog } from '../literature/catalog'
import { createScreeningModel } from '../literature/screening-model'
import { createLogger, errorLogFields } from '../logger'
import { tryDecryptKey } from '../settings/crypto'
import type { SettingsService } from '../settings/service'
import { resolveConfigRoot } from '../storage-root'

export type LiteratureDiscoveryCapability = {
  discovery: LiteratureDiscovery
  signInCnki: () => Promise<CnkiSignInState>
  signOutCnki: () => Promise<CnkiSignInState>
  getCnkiState: () => Promise<CnkiSignInState>
}

export async function composeLiteratureDiscovery({
  settingsService,
  literatureCatalog,
  modules
}: {
  settingsService: SettingsService
  literatureCatalog: LiteratureCatalog
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
      // The CNKI window is a real browser window; it must not outlive the module.
      disposeCnkiSession()
      await runner.shutdown()
    }
  }))
  const log = createLogger('literature:discovery')
  return {
    discovery,
    signInCnki: async () => {
      try {
        return await openCnkiSignIn()
      } catch (error) {
        log.error('Unable to open the CNKI sign-in window', errorLogFields(error))
        return { signedIn: false, message: 'Unable to open the CNKI sign-in window.' }
      }
    },
    signOutCnki: async () => signOutCnki(),
    getCnkiState: async () => getCnkiSignInState()
  }
}
