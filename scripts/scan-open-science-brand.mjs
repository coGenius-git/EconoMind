import { execSync } from 'node:child_process'

const out = execSync(
  'rg -rln "Open Science" src resources docs README.md package.json --glob "!*.test.ts" --glob "!*.test.tsx" 2>$null',
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
)
const files = out
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
for (const f of files) {
  console.log('FILE:', f)
}
console.log('total files:', files.length)
