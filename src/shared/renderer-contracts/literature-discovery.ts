import type {
  DiscoveryImportRequest,
  DiscoveryImportResult,
  DiscoveryQuery,
  DiscoveryScreenRequest,
  DiscoveryScreenResult,
  DiscoverySearchResponse,
  DiscoveryParseRecordsRequest,
  DiscoveryParseRecordsResult
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
  'literature.discoveryParseRecords': callable<
    (request: DiscoveryParseRecordsRequest) => Promise<DiscoveryParseRecordsResult>
  >()('literature', [
    'literature:discovery-parse-records',
    WEB,
    undefined,
    undefined,
    RUNTIME_VALIDATED
  ])
} as const
