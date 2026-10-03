import { cp, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { SpecialistPackageCatalogSnapshot } from '../../shared/specialist-package'
import { BuiltinSpecialistRegistry } from './builtin-registry'
import { toUnpackedSpecialistResourcePath } from './builtin-resource-path'
import { SkillRegistry } from '../skills/registry'
import { parseFrontmatter } from '../skills/frontmatter'
import { ClaudeCodeSkillMaterializer } from '../skills/materializer'
import { ALL_CONNECTOR_IDS } from '../connectors/registry'
import { composeBuiltinSkillCatalog } from './package/builtin-skill-catalog'

const fixtureRoot = join(import.meta.dirname, 'package', 'test-fixtures', 'valid')
const shippedRoot = join(import.meta.dirname, '..', '..', '..', 'resources', 'specialists')
const catalog: SpecialistPackageCatalogSnapshot = {
  appVersion: '0.9.2',
  builtinSkills: [],
  skills: [],
  connectorIds: [],
  protectedSpecialistIds: ['reviewer']
}

describe('BuiltinSpecialistRegistry', () => {
  it('registers a conforming directory as a readonly builtin without duplicating package identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'builtin-specialists-'))
    await cp(fixtureRoot, join(root, 'contribution-one'), { recursive: true })
    await writeFile(
      join(root, 'manifest.json'),
      JSON.stringify({ version: 1, specialists: ['contribution-one'] }),
      'utf8'
    )

    const result = await new BuiltinSpecialistRegistry(catalog, root).load()

    expect(result.diagnostics).toEqual([])
    expect(result.entries).toEqual([
      {
        kind: 'builtin',
        readonly: true,
        id: 'fixture-specialist',
        version: '1.0.0',
        name: 'Fixture Specialist',
        description: 'A valid adapter fixture.',
        systemPrompt: 'Fixture prompt that must stay out of previews and diagnostics.',
        skillIds: [],
        connectorIds: [],
        enabled: true,
        capabilityMode: 'selected',
        fullAccess: { excludedSkillIds: [], excludedConnectorIds: [], connectorTools: [] },
        selectedCapabilities: { skillIds: [], connectorIds: [], connectorTools: [] }
      }
    ])
    expect(result.entries.some((entry) => entry.id === 'reviewer')).toBe(false)
  })

  it('applies validated Skill and Connector references to a builtin Specialist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'builtin-specialists-capabilities-'))
    await cp(fixtureRoot, join(root, 'contribution-one'), { recursive: true })
    await writeFile(
      join(root, 'contribution-one', 'specialist.json'),
      JSON.stringify({
        name: 'Fixture Specialist',
        description: 'A valid adapter fixture.',
        system_prompt: 'Fixture prompt that must stay out of previews and diagnostics.',
        skill_ids: ['literature-review'],
        connector_ids: ['reference-library']
      }),
      'utf8'
    )
    await writeFile(
      join(root, 'manifest.json'),
      JSON.stringify({ version: 1, specialists: ['contribution-one'] }),
      'utf8'
    )

    const result = await new BuiltinSpecialistRegistry(
      {
        ...catalog,
        builtinSkills: [
          {
            id: 'literature-review',
            appVersion: '0.9.2',
            compatibility: 'sha256:literature-review'
          }
        ],
        skills: [{ id: 'literature-review', builtin: true }],
        connectorIds: ['reference-library']
      },
      root
    ).load()

    expect(result.entries[0]?.selectedCapabilities).toEqual({
      skillIds: ['literature-review'],
      connectorIds: ['reference-library'],
      connectorTools: []
    })
  })

  it('gates every shipped contribution without migrating legacy Specialists or Reviewer', async () => {
    const skills = (await new SkillRegistry(join(shippedRoot, '..', 'skills')).list()).filter(
      (skill) => skill.exposure !== 'internal'
    )
    const result = await new BuiltinSpecialistRegistry(
      {
        ...catalog,
        builtinSkills: composeBuiltinSkillCatalog(catalog.appVersion, skills),
        skills: skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          builtin: skill.source === 'featured'
        })),
        connectorIds: ALL_CONNECTOR_IDS
      },
      shippedRoot
    ).load()

    expect(result.diagnostics).toEqual([])
    expect(result.entries.some((entry) => entry.id === 'reviewer')).toBe(false)
    expect(
      Object.fromEntries(result.entries.map((entry) => [entry.id, entry.selectedCapabilities]))
    ).toEqual({
      'literature-agent': {
        skillIds: ['econ-literature-evidence'],
        connectorIds: ['literature'],
        connectorTools: []
      },
      'literature-review-agent': {
        skillIds: ['econ-literature-evidence'],
        connectorIds: ['literature'],
        connectorTools: []
      },
      'methodology-agent': {
        skillIds: ['econ-causal-design'],
        connectorIds: [],
        connectorTools: []
      },
      'data-agent': {
        skillIds: ['econ-data-audit'],
        connectorIds: [],
        connectorTools: []
      },
      'review-agent': {
        skillIds: ['econ-research-review', 'econ-causal-design'],
        connectorIds: ['literature'],
        connectorTools: []
      }
    })

    // Exercise the same source packages and both directory layouts used by Agent runtimes.
    // A catalog reference alone is insufficient: missing files can make a selectable Skill unusable.
    const materializer = new ClaudeCodeSkillMaterializer()
    for (const specialist of result.entries) {
      expect(specialist).toMatchObject({
        kind: 'builtin',
        readonly: true,
        enabled: true,
        capabilityMode: 'selected'
      })
      const selectedSkills = specialist.selectedCapabilities.skillIds.map((id) => {
        const skill = skills.find((candidate) => candidate.id === id)
        expect(skill, `${specialist.id} resolves ${id}`).toBeDefined()
        return skill!
      })

      for (const directoryLayout of ['app-owned', 'agent-facing'] as const) {
        const configDir = await mkdtemp(join(tmpdir(), `builtin-${specialist.id}-`))
        await materializer.sync(configDir, selectedSkills, { directoryLayout })
        const runtimeSkillsDir = join(configDir, 'skills')
        expect(
          (await readdir(runtimeSkillsDir)).filter((name) => !name.startsWith('.')).sort()
        ).toEqual(
          selectedSkills
            .map((skill) => (directoryLayout === 'app-owned' ? `os-${skill.id}` : skill.name))
            .sort()
        )

        for (const skill of selectedSkills) {
          const target = join(
            runtimeSkillsDir,
            directoryLayout === 'app-owned' ? `os-${skill.id}` : skill.name
          )
          const sourceDocument = parseFrontmatter(
            await readFile(join(skill.sourceDir, 'SKILL.md'), 'utf8')
          )
          const projectedDocument = parseFrontmatter(
            await readFile(join(target, 'SKILL.md'), 'utf8')
          )
          expect(projectedDocument.fields.name).toBe(skill.id)
          expect(projectedDocument.fields.license).toBe('MIT')
          expect(projectedDocument.body).toBe(sourceDocument.body)

          const sourceFiles = await readdir(skill.sourceDir, { recursive: true })
          expect(sourceFiles).toEqual(expect.arrayContaining(['SKILL.md', 'SOURCE.md', 'LICENSE']))
          for (const filename of sourceFiles) {
            if (
              filename === 'SKILL.md' ||
              !(await stat(join(skill.sourceDir, filename))).isFile()
            ) {
              continue
            }
            expect(await readFile(join(target, filename)), `${skill.id}/${filename}`).toEqual(
              await readFile(join(skill.sourceDir, filename))
            )
          }

          // Active guidance and attribution must remain self-contained after projection. Archived
          // upstream documents are provenance records, not entrypoints for the adapted workflow.
          for (const filename of ['SKILL.md', 'SOURCE.md']) {
            const document = await readFile(join(target, filename), 'utf8')
            for (const match of document.matchAll(/\]\(([^)\s]+)\)/g)) {
              const href = match[1]
              if (/^[a-z][a-z\d+.-]*:|^#/i.test(href)) continue
              const linkedFile = join(dirname(join(target, filename)), href.split('#')[0])
              expect(relative(target, linkedFile).startsWith('..'), `${skill.id}: ${href}`).toBe(
                false
              )
              expect((await stat(linkedFile)).isFile(), `${skill.id}: ${href}`).toBe(true)
            }
          }
        }
        await materializer.sync(configDir, [], { directoryLayout })
      }
    }
  })

  it('reports concrete diagnostics and omits an invalid builtin instead of partially loading it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'builtin-specialists-invalid-'))
    await cp(fixtureRoot, join(root, 'broken'), { recursive: true })
    await writeFile(join(root, 'broken', 'manifest.json'), '{"id":"broken"}', 'utf8')
    await writeFile(
      join(root, 'manifest.json'),
      JSON.stringify({ version: 1, specialists: ['broken'] }),
      'utf8'
    )

    const result = await new BuiltinSpecialistRegistry(catalog, root).load()

    expect(result.entries).toEqual([])
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', code: expect.stringMatching(/^manifest\./) })
      ])
    )
  })
})

describe('builtin Specialist resource paths', () => {
  it('rewrites packaged app.asar paths and leaves development paths unchanged', () => {
    expect(
      toUnpackedSpecialistResourcePath(
        '/Applications/EconoMind.app/Contents/Resources/app.asar/resources/specialists'
      )
    ).toBe('/Applications/EconoMind.app/Contents/Resources/app.asar.unpacked/resources/specialists')
    expect(toUnpackedSpecialistResourcePath('/repo/resources/specialists')).toBe(
      '/repo/resources/specialists'
    )
  })
})
