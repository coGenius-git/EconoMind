// Round 3: remove molecule-fallback test, fix approval assertion, default-allow key, specialist globs
import { readFileSync, writeFileSync } from 'node:fs'

let s = readFileSync('src/main/connectors/service.test.ts', 'utf8')

// 1. Remove 'falls through to the engine' — it exercised the removed molecule descriptor's run-time error.
const fallsStart = s.indexOf(
  "  it('falls through to the engine when no local handler is registered', async () => {"
)
const fallsEnd = s.indexOf("  it('rejects a blocked tool', async () => {")
if (fallsStart >= 0 && fallsEnd > fallsStart) s = s.slice(0, fallsStart) + s.slice(fallsEnd)

// 2. requests approval: out assertion -> openalex empty shape
s = s.replace(
  "    const out = await svc.call('literature', 'openalex_search_works', { query: 'firm innovation' }, internal)\n    expect(out).toEqual({ n_requested: 1, duplicates: [], records: [{ CID: 1 }], not_found: [] })",
  "    const out = await svc.call('literature', 'openalex_search_works', { query: 'firm innovation' }, internal)\n    expect(out).toEqual({\n      query: 'firm innovation',\n      filters: {},\n      sort: 'relevance',\n      api_total: 0,\n      n_records_returned: 0,\n      records_truncated: false,\n      records: []\n    })"
)

// 3. default-allow dispatch needs the openalex key
s = s.replace(
  "      getConnectors: () => ({ enabledIds: [], autoAllowIds: [] }),\n      resolveApiKey: () => undefined,\n      requestApproval\n    })\n    await svc.call('literature', 'openalex_search_works', { query: 'firm innovation' }, internal)",
  "      getConnectors: () => ({ enabledIds: [], autoAllowIds: [], openAlexApiKeyRef: 'ref' }),\n      resolveApiKey: (ref) => (ref === 'ref' ? 'KEY' : undefined),\n      requestApproval\n    })\n    await svc.call('literature', 'openalex_search_works', { query: 'firm innovation' }, internal)"
)

// 4. Specialist tool-rule globs: molecule/preview_* -> openalex
s = s.replace(
  "      connectorTools: [{ connectorId: 'literature', includedMethods: ['openalex_search_works'] }],\n      method: 'openalex_search_works',\n      allowed: false\n    },\n    {\n      name: 'method in include and exclude lists',",
  "      connectorTools: [{ connectorId: 'literature', includedMethods: ['arxiv_search'] }],\n      method: 'openalex_search_works',\n      allowed: false\n    },\n    {\n      name: 'method in include and exclude lists',"
)
s = s.replaceAll("includeToolsPattern: 'preview_*'", "includeToolsPattern: 'openalex_*'")
s = s.replaceAll("excludeToolsPattern: 'preview_*'", "excludeToolsPattern: 'openalex_*'")

writeFileSync('src/main/connectors/service.test.ts', s, 'utf8')
console.log('ok')
