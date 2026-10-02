// Quick diagnostic: enumerate bundled skills with their manifest id and frontmatter name.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = join(root, 'resources', 'skills')

// Replicate the manifest read the registry uses.
const manifest = JSON.parse(readFileSync(join(skillsRoot, 'manifest.json'), 'utf8'))
const ids = Array.isArray(manifest.skills) ? manifest.skills.map((s) => s.id) : []
console.log('manifest skills:', ids.length)
for (const id of ids) {
  const sourceDir = join(skillsRoot, id)
  const raw = readFileSync(join(sourceDir, 'SKILL.md'), 'utf8')
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw)
  let name = 'NO-FRONTMATTER'
  if (m) {
    const yaml = m[1].split('\n').map((l) => l.trim())
    const nm = yaml.find((l) => l.startsWith('name:'))
    name = nm ? nm.slice(5).trim() : 'NO-NAME'
  }
  if (name !== id) console.log('MISMATCH', id, '=>', JSON.stringify(name))
}
console.log('done')
