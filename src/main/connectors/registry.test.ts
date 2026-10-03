import { Script } from 'node:vm'
import { describe, it, expect, vi } from 'vitest'
import {
  getConnectorTools,
  getDescriptor,
  validateToolArguments,
  ALL_CONNECTOR_IDS
} from './registry'
import { CONNECTOR_CATALOG } from './catalog'

describe('registry + catalog', () => {
  it('resolves a tool by connector+method', () => {
    expect(getDescriptor('zenodo', 'search_records')?.id).toBe('search_records')
    expect(getDescriptor('zenodo', 'nope')).toBeUndefined()
  })
  it('lists tools for a connector', () => {
    expect(getConnectorTools('literature').map((t) => t.id)).toContain('openalex_search_works')
  })
  it('catalog ids and registry ids are consistent', () => {
    for (const meta of CONNECTOR_CATALOG) expect(ALL_CONNECTOR_IDS).toContain(meta.id)
    for (const id of ALL_CONNECTOR_IDS) expect(CONNECTOR_CATALOG.map((c) => c.id)).toContain(id)
  })
  it('uses kebab-case for every bundled connector identity', () => {
    for (const id of ALL_CONNECTOR_IDS) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
  it('compiles every bundled input Schema when the registry loads', () => {
    expect(ALL_CONNECTOR_IDS.flatMap(getConnectorTools).length).toBeGreaterThan(0)
  })
  it('validates arguments against the compiled input Schema without coercion', () => {
    const descriptor = getDescriptor('zenodo', 'search_records')!

    expect(() =>
      validateToolArguments(descriptor, { query: 'economics', page_size: 5 })
    ).not.toThrow()
    expect(() => validateToolArguments(descriptor, { query: 'economics', page_size: '5' })).toThrow(
      /invalid tool arguments.*page_size.*integer/i
    )
  })
})

// Authored examples are part of the agent-facing contract, not illustrative pseudocode.
describe('bundled tool contracts', () => {
  const tools = ALL_CONNECTOR_IDS.flatMap(getConnectorTools)
  it('keeps every public connector/method identity unique', () => {
    expect(new Set(tools.map((tool) => `${tool.connector}/${tool.id}`)).size).toBe(tools.length)
    expect(new Set(CONNECTOR_CATALOG.map((connector) => connector.id)).size).toBe(
      CONNECTOR_CATALOG.length
    )
  })

  it.each(tools)(
    '$connector/$id has a runnable, schema-valid example and return documentation',
    async (tool) => {
      expect(tool.id).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(tool.description.trim()).not.toBe('')
      expect(tool.returns?.trim()).toBeTruthy()
      expect(tool.example?.trim()).toBeTruthy()
      expect(
        typeof tool.run === 'function' ||
          (typeof tool.url === 'function' && typeof tool.parse === 'function')
      ).toBe(true)
      const mcp = vi.fn((connector: string, method: string, args: Record<string, unknown> = {}) => {
        expect([connector, method]).toEqual([tool.connector, tool.id])
        validateToolArguments(tool, args)
        return {}
      })
      // Repository-authored code only; the stub never dispatches or accesses credentials/network.
      await new Script(`(async () => { ${tool.example} })()`).runInNewContext(
        { host: { mcp } },
        { timeout: 1000 }
      )
      expect(mcp).toHaveBeenCalledTimes(1)
    }
  )
})

describe('Zenodo input contracts', () => {
  it.each([
    {},
    { query: '' },
    { query: '\u3000 ' },
    { query: 'x'.repeat(1001) },
    { query: 'x', page: 0 },
    { query: 'x', page: '2' },
    { query: 'x', page: 1.5 },
    { query: 'x', page_size: 26 },
    { query: 'x', page_size: 0 },
    { query: 'x', all_versions: 'true' },
    { query: 'x', sort: 'unknown' },
    { query: 'x', url: 'https://example.com' }
  ])('rejects invalid search arguments: %j', (args) => {
    expect(() => validateToolArguments(getDescriptor('zenodo', 'search_records')!, args)).toThrow(
      /invalid_arguments/
    )
  })

  it('counts the query limit in Unicode code points', () => {
    const descriptor = getDescriptor('zenodo', 'search_records')!
    expect(() => validateToolArguments(descriptor, { query: '😀'.repeat(1000) })).not.toThrow()
    expect(() => validateToolArguments(descriptor, { query: '😀'.repeat(1001) })).toThrow(
      /invalid_arguments/
    )
  })

  it.each(['0', '../1', '8435696?download=1', '01', '10.5281/zenodo.8435696', 8435696])(
    'rejects noncanonical record IDs: %s',
    (recordId) => {
      expect(() =>
        validateToolArguments(getDescriptor('zenodo', 'get_record')!, { record_id: recordId })
      ).toThrow(/invalid_arguments/)
    }
  )
})
