// Round 2: openalex credential wiring + remove pubmed-only test + arxiv fallback
import { readFileSync, writeFileSync } from 'node:fs'

let s = readFileSync('src/main/connectors/service.test.ts', 'utf8')

// 1. routes an enabled call through the engine with resolved credentials
s = s.replace(
  "        contactEmail: 'x@y.org',\n        ncbiApiKeyRef: 'ref'\n",
  "        contactEmail: 'x@y.org',\n        openAlexApiKeyRef: 'ref'\n"
)
s = s.replace(
  "    const out = await svc.call('literature', 'openalex_search_works', { query: 'firm innovation' }, internal)\n    expect(out).toEqual({ n_requested: 1, duplicates: [], records: [{ CID: 1 }], not_found: [] })\n",
  "    const out = await svc.call('literature', 'openalex_search_works', { query: 'firm innovation' }, internal)\n    expect(out).toEqual({\n      query: 'firm innovation',\n      filters: {},\n      sort: 'relevance',\n      api_total: 0,\n      n_records_returned: 0,\n      records_truncated: false,\n      records: []\n    })\n"
)

// 2. remove the pubmed-only bundled-handler test (single-id list coercion was pubmed-specific)
const pubmedStart = s.indexOf(
  "  it('preserves bundled handler support for a single id when the schema recommends a list', async () => {"
)
const pubmedEnd = s.indexOf(
  "  it('rejects bundled tool arguments that do not match the registered JSON Schema', async () => {"
)
if (pubmedStart >= 0 && pubmedEnd > pubmedStart) {
  s = s.slice(0, pubmedStart) + s.slice(pubmedEnd)
}

// 3. falls through to the engine: openalex needs credentials; use arxiv_search (credential-free)
s = s.replace(
  "      svc.call('literature', 'openalex_search_works', { query: 'firm innovation' }, internal)\n    ).rejects.toThrow(/handled by the app runtime/)",
  "      svc.call('literature', 'arxiv_search', { query: 'firm innovation' }, internal)\n    ).rejects.toThrow(/handled by the app runtime/)"
)

// 4. approval tests that dispatch: give openalex a resolvable key ref
s = s.replaceAll(
  "        askToolIds: ['literature/openalex_search_works']\n      }),\n      resolveApiKey: () => undefined,\n",
  "        askToolIds: ['literature/openalex_search_works'],\n        openAlexApiKeyRef: 'ref'\n      }),\n      resolveApiKey: (ref) => (ref === 'ref' ? 'KEY' : undefined),\n"
)

// 5. default-allow dispatch (no askToolIds) still needs the openalex key
s = s.replace(
  "      getConnectors: () => ({ enabledIds: [], autoAllowIds: [] }),\n      resolveApiKey: () => undefined,\n      requestApproval\n    })\n\n    await svc.call(\n      'literature',\n      'openalex_search_works',\n      { query: 'firm innovation' },\n      { sessionId: 'session-1', projectId: 'project-1' }\n    )",
  "      getConnectors: () => ({ enabledIds: [], autoAllowIds: [], openAlexApiKeyRef: 'ref' }),\n      resolveApiKey: (ref) => (ref === 'ref' ? 'KEY' : undefined),\n      requestApproval\n    })\n\n    await svc.call(\n      'literature',\n      'openalex_search_works',\n      { query: 'firm innovation' },\n      { sessionId: 'session-1', projectId: 'project-1' }\n    )"
)

writeFileSync('src/main/connectors/service.test.ts', s, 'utf8')
console.log('ok')
