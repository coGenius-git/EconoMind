/* eslint-disable */
// Updates migration-service.test.ts expectations after adding 0041_project_category.
// All line references are 1-based against the CURRENT file.
import { readFile, writeFile } from 'node:fs/promises'

const path = 'src/main/database/migration-service.test.ts'
const lines = (await readFile(path, 'utf8')).split('\n')
const at = (n) => lines[n - 1]

// 1. from/to ledger-tail references -> 0041 (every occurrence is the released tail).
for (let i = 0; i < lines.length; i++) {
  lines[i] = lines[i].replace(
    /(from|to): '0040_literature_collection_revision'/,
    "$1: '0041_project_category'"
  )
}

// 2. Specific single-line edits.
const edits = {
  335: (l) =>
    l.replace(
      `('0039_literature_metadata_commit_receipt', '0040_literature_collection_revision')`,
      `('0039_literature_metadata_commit_receipt', '0040_literature_collection_revision', '0041_project_category')`
    ),
  343: (l) =>
    l.replace(
      `['0039_literature_metadata_commit_receipt', '0040_literature_collection_revision']`,
      `['0039_literature_metadata_commit_receipt', '0040_literature_collection_revision', '0041_project_category']`
    ),
  349: (l) =>
    l.replace(
      `('0039_literature_metadata_commit_receipt', '0040_literature_collection_revision')`,
      `('0039_literature_metadata_commit_receipt', '0040_literature_collection_revision', '0041_project_category')`
    ),
  1278: (l) => l.replace(`'0040_literature_collection_revision'`, `'0041_project_category'`),
  1342: (l) => `${l.trimEnd()},`
}
for (const [n, fn] of Object.entries(edits)) {
  lines[Number(n) - 1] = fn(lines[Number(n) - 1])
}

// 3. List tails: insert a new element after the 0040 element (descending to keep refs stable).
const insertAfter0040 = [
  696, 745, 856, 950, 1058, 1152, 1435, 1665, 1931, 2068, 2157, 2249, 2375, 3208, 3342
]
for (const n of [...insertAfter0040].sort((a, b) => b - a)) {
  const raw = lines[n - 1]
  const indent = raw.match(/^\s*/)[0]
  const hasComma = raw.trimEnd().endsWith(',')
  lines[n - 1] = hasComma ? raw : `${raw.trimEnd()},`
  lines.splice(n, 0, `${indent}'0041_project_category'`)
}

// 4. Ledger-row lists (1342 object list, 1532 object list, 2899 backup names).
{
  const n = 1342
  const indent = lines[n - 1].match(/^\s*/)[0]
  lines[n - 1] = `${lines[n - 1].trimEnd()},`
  lines.splice(n, 0, `${indent}{ id: '0041_project_category' },`)
}
{
  const n = 1532
  const indent = lines[n - 1].match(/^\s*/)[0]
  lines[n - 1] = `${lines[n - 1].trimEnd()},`
  lines.splice(n, 0, `${indent}{ id: '0041_project_category' }`)
}
{
  const n = 2899
  const indent = lines[n - 1].match(/^\s*/)[0]
  lines[n - 1] = `${lines[n - 1].trimEnd()},`
  lines.splice(n, 0, `${indent}'open-science.db.before-0041_project_category.backup',`)
}

await writeFile(path, lines.join('\n'), 'utf8')
console.log('done')
