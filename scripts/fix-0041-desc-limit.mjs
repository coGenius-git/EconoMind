import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/database/compute-job-operation-migration.test.ts'
let c = readFileSync(p, 'utf8')
const n = c.replace(
  "      { id: '0040_literature_collection_revision' },\n      { id: '0039_literature_metadata_commit_receipt' }",
  "      { id: '0041_project_category' },\n      { id: '0040_literature_collection_revision' }"
)
writeFileSync(p, n, 'utf8')
console.log('op-migration changed:', c !== n)
