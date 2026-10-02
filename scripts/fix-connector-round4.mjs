// Round 4: fix selected-omitted connectorIds and outside-glob case
import { readFileSync, writeFileSync } from 'node:fs'

let s = readFileSync('src/main/connectors/service.test.ts', 'utf8')

// selected-omitted: connectorIds must NOT include 'literature' (the call's connector) so it is denied
s = s.replace(
  "      selectedCapabilities: { skillIds: [], connectorIds: ['literature'], connectorTools: [] }\n    })\n    await expect(\n      svc.call(\n        'literature',\n        'openalex_search_works',\n        { query: 'SECRET_ARGS' },\n        {\n          origin: 'agent',\n          sessionId: 'selected-omitted',",
  "      selectedCapabilities: { skillIds: [], connectorIds: ['finance'], connectorTools: [] }\n    })\n    await expect(\n      svc.call(\n        'literature',\n        'openalex_search_works',\n        { query: 'SECRET_ARGS' },\n        {\n          origin: 'agent',\n          sessionId: 'selected-omitted',"
)

// 'method outside anchored include glob': keep glob that does NOT match openalex_search_works
s = s.replace(
  "      name: 'method outside anchored include glob',\n      connectorTools: [{ connectorId: 'literature', includeToolsPattern: 'openalex_*' }],",
  "      name: 'method outside anchored include glob',\n      connectorTools: [{ connectorId: 'literature', includeToolsPattern: 'arxiv_*' }],"
)

writeFileSync('src/main/connectors/service.test.ts', s, 'utf8')
console.log('ok')
