import { mkdtemp, mkdir, access, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONNECTOR_CATALOG } from './catalog'
import {
  ALL_CONNECTOR_IDS,
  RETIRED_BUILTIN_CONNECTOR_IDS,
  getConnectorTools,
  getDescriptor
} from './registry'
import { syncConnectorSkillDocs } from './provision'
import { RENDERER_CONTRACT_CATALOG } from '../../shared/renderer-contract-catalog'

describe('EconoMind supported capabilities', () => {
  it('exposes only general literature, funding and research datasets as built-in connectors', () => {
    expect(ALL_CONNECTOR_IDS.slice().sort()).toEqual(['literature', 'research-resources', 'zenodo'])
    expect(CONNECTOR_CATALOG.map((item) => item.id).sort()).toEqual(
      ALL_CONNECTOR_IDS.slice().sort()
    )
    for (const id of RETIRED_BUILTIN_CONNECTOR_IDS) {
      expect(getConnectorTools(id)).toEqual([])
      expect(getDescriptor(id, 'search')).toBeUndefined()
    }
    expect(getConnectorTools('research-resources').every((tool) => !/antibod/i.test(tool.id))).toBe(
      true
    )
    expect(getConnectorTools('research-resources').length).toBeGreaterThan(0)
  })

  it('does not publish remote or marketplace commands to any renderer transport', () => {
    expect(
      RENDERER_CONTRACT_CATALOG.filter((contract) =>
        /remoteAccess|marketplace/i.test(contract.publicPath)
      )
    ).toEqual([])
    for (const path of [
      'settings.createSkill',
      'settings.importSkillZip',
      'specialist.create',
      'specialist.installPackage'
    ]) {
      expect(RENDERER_CONTRACT_CATALOG.some((contract) => contract.publicPath === path)).toBe(true)
    }
  })

  it('removes retired generated connector skills while preserving custom skills', async () => {
    const root = await mkdtemp(join(tmpdir(), 'economind-connectors-'))
    try {
      await mkdir(join(root, 'mcp-pubmed'))
      await writeFile(join(root, 'mcp-pubmed', 'SKILL.md'), 'generated biomedical connector')
      await mkdir(join(root, 'my-research'))
      await writeFile(join(root, 'my-research', 'SKILL.md'), 'user content')
      await syncConnectorSkillDocs(root, ['literature', 'pubmed'])
      await expect(access(join(root, 'mcp-pubmed'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(join(root, 'my-research', 'SKILL.md'), 'utf8')).toBe('user content')
      expect(await readFile(join(root, 'mcp-literature', 'SKILL.md'), 'utf8')).toContain('OpenAlex')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
