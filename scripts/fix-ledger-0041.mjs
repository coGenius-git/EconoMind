import { readFileSync, writeFileSync } from 'node:fs'

const p = 'scripts/database-migration-ledger-smoke.test.ts'
let c = readFileSync(p, 'utf8')
const target =
  "'0038_literature_search_text', '0039_literature_metadata_commit_receipt', '0040_literature_collection_revision'\n         )`"
const replacement =
  "'0038_literature_search_text', '0039_literature_metadata_commit_receipt', '0040_literature_collection_revision', '0041_project_category'\n         )`"
const n = c.replace(target, replacement)
console.log('changed:', c !== n)
writeFileSync(p, n, 'utf8')
