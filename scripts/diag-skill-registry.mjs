// Match the failing test exactly: SkillRegistry + parseFrontmatter over the bundled root.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from '../src/main/skills/frontmatter'
import { SkillRegistry } from '../src/main/skills/registry'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = join(root, 'resources', 'skills')
const registry = await new SkillRegistry(skillsRoot).list()
console.log('list length:', registry.length)
for (const skill of registry) {
  const raw = readFileSync(join(skill.sourceDir, 'SKILL.md'), 'utf8')
  const fields = parseFrontmatter(raw).fields
  if (fields.name !== skill.id) {
    console.log(
      'MISMATCH',
      JSON.stringify(skill.id),
      'sourceDir=',
      skill.sourceDir,
      'name=',
      JSON.stringify(fields.name)
    )
  }
}
console.log('done')
