// Round 6: final skill-doc migrations (renderSkillDoc connector ids + remaining pubmed/chemistry fixtures)
import { readFileSync, writeFileSync } from 'node:fs'

// ---------- skill-doc.test.ts ----------
let a = readFileSync('src/main/connectors/skill-doc.test.ts', 'utf8')
// connector-id arguments to renderSkillDoc must be 'literature' (the only remaining catalog id)
a = a.replace(
  "    const md = renderSkillDoc('chemistry')",
  "    const md = renderSkillDoc('literature')"
)
a = a.replaceAll(
  "    const md = renderSkillDoc('pubmed')",
  "    const md = renderSkillDoc('literature')"
)
a = a.replace(
  "    const md = renderSkillDoc('arxiv')",
  "    const md = renderSkillDoc('literature')"
)
writeFileSync('src/main/connectors/skill-doc.test.ts', a, 'utf8')

// ---------- custom-skill-doc.test.ts ----------
let b = readFileSync('src/main/connectors/custom-skill-doc.test.ts', 'utf8')
b = b.replace(
  "    const bundledId = makeServer({ name: 'chemistry', displayName: 'Other server' })",
  "    const bundledId = makeServer({ name: 'literature', displayName: 'Other server' })"
)
b = b.replace(
  "    expect(doc).toContain('name: mcp-chemistry')",
  "    expect(doc).toContain('name: mcp-literature')"
)
b = b.replaceAll("'mcp-pubmed'", "'mcp-literature'")
writeFileSync('src/main/connectors/custom-skill-doc.test.ts', b, 'utf8')

console.log('ok')
