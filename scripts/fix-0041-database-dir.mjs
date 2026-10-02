import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'src/main/database'
const files = readdirSync(dir).filter((f) => f.endsWith('.test.ts'))
for (const f of files) {
  const p = join(dir, f)
  const c = readFileSync(p, 'utf8')
  let n = c
  n = n.replace(
    /(['"]0040_literature_collection_revision['"])\r?\n(\s*)(\]|\],)/g,
    (_, id, ws, br) => `${id},\n${ws}'0041_project_category'\n${ws}${br}`
  )
  n = n.split("to: '0040_literature_collection_revision'").join("to: '0041_project_category'")
  if (n !== c) {
    writeFileSync(p, n, 'utf8')
    console.log('changed:', f)
  }
}
