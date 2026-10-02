import { readFileSync, writeFileSync } from 'node:fs'

const targets = [
  'src/main/database/compute-job-remote-cleanup-migration.test.ts',
  'src/main/database/database-json-constraints-migration.test.ts'
]
for (const p of targets) {
  const c = readFileSync(p, 'utf8')
  const n = c.split("to: '0040_literature_collection_revision'").join("to: '0041_project_category'")
  writeFileSync(p, n, 'utf8')
  console.log(p, c !== n)
}
