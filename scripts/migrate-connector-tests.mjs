// Migrate service.test.ts connector fixtures from removed science connectors to literature.
import { readFileSync, writeFileSync } from 'node:fs'

let s = readFileSync('src/main/connectors/service.test.ts', 'utf8')
const before = s.length
const reps = [
  [/'molecule\/preview_molecule'/g, "'literature/openalex_search_works'"],
  [/'chemistry\/pubchem_get_compounds'/g, "'literature/openalex_search_works'"],
  [/'chemistry'/g, "'literature'"],
  [/'molecule'/g, "'literature'"],
  [/'pubmed'/g, "'literature'"],
  [/'pubchem_get_compounds'/g, "'openalex_search_works'"],
  [/'preview_molecule'/g, "'openalex_search_works'"],
  [/'convert_article_ids'/g, "'openalex_search_works'"],
  [/\{ smiles: 'C' \}/g, "{ query: 'firm innovation' }"],
  [/\{ smiles: 'CCO' \}/g, "{ query: 'innovation' }"],
  [/\{ smiles: 42 \}/g, '{ query: 42 }'],
  [/\{ smiles: 'SECRET_ARGS' \}/g, "{ query: 'SECRET_ARGS' }"],
  [/\{ cids: \[1\] \}/g, "{ query: 'firm innovation' }"],
  [/\{ cids: '2244' \}/g, '{ query: 42 }']
]
for (const [re, to] of reps) {
  const n = s.split(re).length - 1
  s = s.replace(re, to)
  if (n) console.log(re, '=>', n)
}
writeFileSync('src/main/connectors/service.test.ts', s, 'utf8')
console.log('bytes', before, '->', s.length)
