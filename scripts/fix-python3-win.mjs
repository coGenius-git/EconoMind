import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/artifacts/code-reconstruction.test.ts'
const c = readFileSync(p, 'utf8')
const count = (c.match(/'python3'/g) || []).length
const n = c.split("'python3'").join('pythonExecutable')
writeFileSync(p, n, 'utf8')
console.log('replaced occurrences:', count)
