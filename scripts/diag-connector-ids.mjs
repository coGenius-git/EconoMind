import { execSync } from 'node:child_process'
const m = execSync(
  'node -e "console.log(JSON.stringify(require(\'./src/main/connectors/descriptors/literature\').LITERATURE_TOOLS.map(t=>t.connector)))"',
  { encoding: 'utf8' }
)
console.log(m.trim())
