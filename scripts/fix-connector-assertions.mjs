// Fix assertion literals after connector migration
import { readFileSync, writeFileSync } from 'node:fs'

let s = readFileSync('src/main/connectors/service.test.ts', 'utf8')
s = s.replaceAll('Connector "chemistry" is disabled.', 'Connector "literature" is disabled.')
s = s.replaceAll('unknown tool: chemistry/nope.', 'unknown tool: literature/nope.')
s = s.replaceAll(
  '/invalid tool arguments.*cids.*array/i',
  '/invalid tool arguments.*query.*string/i'
)
s = s.replaceAll(
  '/invalid tool arguments.*smiles.*string/i',
  '/invalid tool arguments.*query.*string/i'
)
s = s.replaceAll('/Connector "molecule" is disabled/', '/Connector "literature" is disabled/')
s = s.replaceAll("'mcp:chemistry/pubchem_get_compounds'", "'mcp:literature/openalex_search_works'")
s = s.replaceAll("'render_molecule'", "'openalex_search_works'")
s = s.replaceAll("'molecule/render_molecule'", "'literature/openalex_search_works'")
writeFileSync('src/main/connectors/service.test.ts', s, 'utf8')
console.log('ok')
