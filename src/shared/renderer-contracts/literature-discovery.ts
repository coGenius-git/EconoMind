import type {
  DiscoveryImportRequest,
  DiscoveryImportResult,
  DiscoveryQuery,
  DiscoveryScreenRequest,
  DiscoveryScreenResult,
  DiscoverySearchResponse,
  DiscoverySignInResponse,
  DiscoverySourceId
} from '../literature-discovery'

import { callable, RUNTIME_VALIDATED, WEB } from './definition'

export const contracts = {
  'literature.discoverySearch': callable<
    (request: DiscoveryQuery) => Promise<DiscoverySearchResponse>
  >()('literature', ['literature:discovery-search', WEB, undefined, undefined, RUNTIME_VALIDATED]),
  'literature.discoveryImport': callable<
    (request: DiscoveryImportRequest) => Promise<DiscoveryImportResult>
  >()('literature', ['literature:discovery-import', WEB, undefined, undefined, RUNTIME_VALIDATED]),
  'literature.discoveryScreen': callable<
    (request: DiscoveryScreenRequest) => Promise<DiscoveryScreenResult>
  >()('literature', ['literature:discovery-screen', WEB, undefined, undefined, RUNTIME_VALIDATED]),
  'literature.discoverySignIn': callable<
    (source: DiscoverySourceId) => Promise<DiscoverySignInResponse>
  >()('literature', ['literature:discovery-sign-in', WEB, undefined, undefined, RUNTIME_VALIDATED]),
  'literature.discoverySignOut': callable<
    (source: DiscoverySourceId) => Promise<DiscoverySignInResponse>
  >()('literature', [
    'literature:discovery-sign-out',
    WEB,
    undefined,
    undefined,
    RUNTIME_VALIDATED
  ]),
  'literature.discoveryStatus': callable<
    (source: DiscoverySourceId) => Promise<DiscoverySignInResponse>
  >()('literature', ['literature:discovery-status', WEB, undefined, undefined, RUNTIME_VALIDATED])
} as const
