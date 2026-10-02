import { readFileSync, writeFileSync } from 'node:fs'

const targets = [
  'src/main/database/compute-job-operation-migration.test.ts',
  'src/main/database/permission-approval-summary.test.ts'
]
for (const p of targets) {
  const c = readFileSync(p, 'utf8')
  const n = c
    .split("'0040_literature_collection_revision')")
    .join("'0040_literature_collection_revision', '0041_project_category')")
  writeFileSync(p, n, 'utf8')
  console.log(p, c !== n)
}
