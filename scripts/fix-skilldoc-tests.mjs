// Round 5: migrate skill-doc tests from deleted scientific connectors to literature
import { readFileSync, writeFileSync } from 'node:fs'

// ---------- skill-doc.test.ts ----------
let a = readFileSync('src/main/connectors/skill-doc.test.ts', 'utf8')

a = a.replace(
  "    const md = renderConnectorInstructions(['mcp-chemistry'])",
  "    const md = renderConnectorInstructions(['mcp-literature'])"
)
a = a.replace(
  "    expect(md).not.toContain('## chemistry')",
  "    expect(md).not.toContain('## literature')"
)
a = a.replace(
  "    expect(md).not.toContain('pubchem_get_compounds')",
  "    expect(md).not.toContain('openalex_search_works')"
)

a = a.replace(
  "    const md = renderConnectorInstructions(['mcp-pubmed'])",
  "    const md = renderConnectorInstructions(['mcp-literature'])"
)

a = a.replace(
  "      'mcp-pubmed',\n      'mcp-literature',\n      'mcp-pubmed',\n      'not-a-skill'\n",
  "      'mcp-literature',\n      'mcp-literature',\n      'mcp-literature',\n      'not-a-skill'\n"
)
a = a.replace(
  "    expect(md).toContain('Globally Enabled Connector Skills: `mcp-pubmed`, `mcp-literature`.')\n",
  "    expect(md).toContain('Globally Enabled Connector Skills: `mcp-literature`.')\n"
)
a = a.replace(
  '    expect(md.match(/`mcp-pubmed`/g)).toHaveLength(1)',
  '    expect(md.match(/`mcp-literature`/g)).toHaveLength(1)'
)

a = a.replace(
  "    const md = renderConnectorInstructions(['mcp-pubmed', 'mcp-custom-chemistry'])",
  "    const md = renderConnectorInstructions(['mcp-literature', 'mcp-custom-acme'])"
)
a = a.replace(
  "    expect(md).toContain('Globally Enabled Connector Skills: `mcp-pubmed`, `mcp-custom-chemistry`.')\n",
  "    expect(md).toContain('Globally Enabled Connector Skills: `mcp-literature`, `mcp-custom-acme`.')\n"
)

a = a.replace(
  "    const md = renderSkillDoc('chemistry')",
  "    const md = renderSkillDoc('literature')"
)
a = a.replace(
  "    expect(md).toContain('name: mcp-chemistry')",
  "    expect(md).toContain('name: mcp-literature')"
)
a = a.replace(
  "    expect(md).toContain('pubchem_get_compounds')",
  "    expect(md).toContain('openalex_search_works')"
)

a = a.replace("    const md = renderSkillDoc('pubmed')", "    const md = renderSkillDoc('arxiv')")
a = a.replace(
  "    const block = md.slice(\n      md.indexOf('### search_articles'),\n      md.indexOf('### get_article_metadata')\n    )",
  "    const block = md.slice(\n      md.indexOf('### arxiv_search'),\n      md.indexOf('### arxiv_get_papers')\n    )"
)
a = a.replace(
  '      \'const result = await host.mcp("pubmed", "search_articles", {"query": "CRISPR gene editing", "max_results": 10})\'',
  '      \'const result = await host.mcp("literature", "arxiv_search", {"query": "ti:transformer", "category": "cs.LG", "max_results": 10})\''
)
a = a.replace(
  "    const baseline = renderConnectorInstructions(['mcp-pubmed'])",
  "    const baseline = renderConnectorInstructions(['mcp-literature'])"
)

a = a.replace(
  "  it('keeps the PubMed Skill under a 2.3k-token on-demand budget', () => {",
  "  it('keeps the arXiv Skill under a 2.3k-token on-demand budget', () => {"
)

writeFileSync('src/main/connectors/skill-doc.test.ts', a, 'utf8')

// ---------- custom-skill-doc.test.ts ----------
let b = readFileSync('src/main/connectors/custom-skill-doc.test.ts', 'utf8')
b = b.replaceAll("'custom-chemistry'", "'custom-acme'")
b = b.replaceAll("displayName: 'chemistry'", "displayName: 'literature'")
b = b.replaceAll("'mcp-custom-chemistry'", "'mcp-custom-acme'")
b = b.replaceAll("'mcp-Chemistry'", "'mcp-Literature'")
b = b.replaceAll("'mcp-chemistry'", "'mcp-literature'")
b = b.replaceAll("['chemistry']", "['literature']")
b = b.replaceAll("name: 'Chemistry'", "name: 'Literature'")
b = b.replaceAll('No `mcp-chemistry` directory', 'No `mcp-literature` directory')
b = b.replaceAll('built-in chemistry doc', 'built-in literature doc')
b = b.replaceAll('`mcp-Chemistry` and `mcp-chemistry`', '`mcp-Literature` and `mcp-literature`')
writeFileSync('src/main/connectors/custom-skill-doc.test.ts', b, 'utf8')

console.log('ok')
