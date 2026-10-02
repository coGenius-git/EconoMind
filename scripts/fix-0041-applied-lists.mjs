import { readFileSync, writeFileSync } from 'node:fs'

const targets = [
  'src/main/database/permission-approval-summary.test.ts',
  'src/main/database/database-json-constraints-migration.test.ts',
  'src/main/database/compute-job-remote-cleanup-migration.test.ts',
  'src/main/database/content-verification-observation.test.ts'
]
for (const p of targets) {
  const c = readFileSync(p, 'utf8')
  const n = c.replace(
    /('0040_literature_collection_revision')\n(\s*)(\]|\],)/g,
    (_, id, ws, br) => `${id},\n${ws}'0041_project_category'\n${ws}${br}`
  )
  writeFileSync(p, n, 'utf8')
  console.log(p, c !== n)
}
