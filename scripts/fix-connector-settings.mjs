// Round 8: connector-settings chemistry/pubmed -> literature
import { readFileSync, writeFileSync } from 'node:fs'

let s = readFileSync('src/main/settings/connector-settings.test.ts', 'utf8')
s = s.replaceAll("'mcp-pubmed'", "'mcp-literature'")
s = s.replace(
  "      addCustomServer({ name: 'chemistry', transport: 'stdio', command: 'example-mcp' })",
  "      addCustomServer({ name: 'literature', transport: 'stdio', command: 'example-mcp' })"
)
s = s.replace(
  "      id: 'legacy-reserved-route',\n      name: 'Chemistry!',",
  "      id: 'legacy-reserved-route',\n      name: 'Literature!',"
)
s = s.replace(
  "      name: 'chemistry',\n      displayName: 'Chemistry!',",
  "      name: 'literature',\n      displayName: 'Literature!',"
)
s = s.replace(
  "              id: 'chemistry',\n              name: 'built-in-id-collision',",
  "              id: 'literature',\n              name: 'built-in-id-collision',"
)
writeFileSync('src/main/settings/connector-settings.test.ts', s, 'utf8')
console.log('ok')
