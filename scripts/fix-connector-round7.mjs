// Round 7: provision + custom-mcp-bootstrap chemistry -> literature
import { readFileSync, writeFileSync } from 'node:fs'

let p = readFileSync('src/main/connectors/provision.test.ts', 'utf8')
p = p.replaceAll('mcp-pubmed', 'mcp-literature')
p = p.replaceAll("'chemistry'", "'literature'")
p = p.replaceAll('mcp-chemistry', 'mcp-literature')
writeFileSync('src/main/connectors/provision.test.ts', p, 'utf8')

let b = readFileSync('src/main/connectors/custom-mcp-bootstrap.test.ts', 'utf8')
b = b.replaceAll("'chemistry'", "'literature'")
b = b.replaceAll('"chemistry"', '"literature"')
writeFileSync('src/main/connectors/custom-mcp-bootstrap.test.ts', b, 'utf8')

console.log('ok')
