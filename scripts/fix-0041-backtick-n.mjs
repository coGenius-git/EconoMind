import { readFileSync, writeFileSync } from 'node:fs'

const targets = [
  'src/main/database/database-startup-logging.test.ts',
  'src/main/database/literature-inbox-integrity-migration.test.ts',
  'src/main/database/application-database.integration.test.ts'
]
for (const p of targets) {
  const c = readFileSync(p, 'utf8')
  // Repair literal backtick-n sequences introduced by an earlier PowerShell batch edit.
  const n = c.split('`n').join('\n')
  writeFileSync(p, n, 'utf8')
  console.log(p, c !== n)
}
