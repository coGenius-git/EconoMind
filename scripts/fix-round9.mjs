// Round 9: agents-service chemistry -> literature; migration tests 0040 -> 0041
import { readFileSync, writeFileSync } from 'node:fs'

// agents-service.test.ts
let a = readFileSync('src/main/agents/agents-service.test.ts', 'utf8')
a = a.replaceAll("connectorIds: ['chemistry']", "connectorIds: ['literature']")
a = a.replaceAll("disabledConnectorIds: ['chemistry']", "disabledConnectorIds: ['literature']")
a = a.replaceAll("          name: 'chemistry',", "          name: 'literature',")
a = a.replaceAll(
  "const chemistry = connectors.find((c) => c.id === 'chemistry')",
  "const chemistry = connectors.find((c) => c.id === 'literature')"
)
a = a.replaceAll(
  "connectors.filter((connector) => connector.id === 'chemistry')",
  "connectors.filter((connector) => connector.id === 'literature')"
)
writeFileSync('src/main/agents/agents-service.test.ts', a, 'utf8')

// agent-memory-project-scope-migration.test.ts
let b = readFileSync('src/main/database/agent-memory-project-scope-migration.test.ts', 'utf8')
b = b.replaceAll("'0040_literature_collection_revision'", "'0041_project_category'")
writeFileSync('src/main/database/agent-memory-project-scope-migration.test.ts', b, 'utf8')

// project-session-defaults-migration.test.ts
let c = readFileSync('src/main/database/project-session-defaults-migration.test.ts', 'utf8')
c = c.replaceAll("'0040_literature_collection_revision'", "'0041_project_category'")
writeFileSync('src/main/database/project-session-defaults-migration.test.ts', c, 'utf8')

// project-archive-revision.test.ts
let d = readFileSync('src/main/database/project-archive-revision.test.ts', 'utf8')
d = d.replace(
  "'0040_literature_collection_revision')",
  "'0040_literature_collection_revision', '0041_project_category')"
)
d = d.replace(
  "        '0040_literature_collection_revision'\n      ]",
  "        '0040_literature_collection_revision',\n        '0041_project_category'\n      ]"
)
writeFileSync('src/main/database/project-archive-revision.test.ts', d, 'utf8')

console.log('ok')
