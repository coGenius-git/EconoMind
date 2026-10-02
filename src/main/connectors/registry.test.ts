import { describe, it, expect } from 'vitest'
import {
  getConnectorTools,
  getDescriptor,
  validateToolArguments,
  ALL_CONNECTOR_IDS
} from './registry'
import { CONNECTOR_CATALOG } from './catalog'

describe('registry + catalog', () => {
  it('resolves a tool by connector+method', () => {
    expect(getDescriptor('literature', 'openalex_search_works')?.id).toBe('openalex_search_works')
    expect(getDescriptor('literature', 'nope')).toBeUndefined()
  })
  it('lists tools for a connector', () => {
    expect(getConnectorTools('literature').map((t) => t.id)).toContain('arxiv_search')
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
    const descriptor = getDescriptor('literature', 'openalex_search_works')!

    expect(() =>
      validateToolArguments(descriptor, { query: 'digital transformation', max_records: 5 })
    ).not.toThrow()
    expect(() =>
      validateToolArguments(descriptor, { query: 'digital transformation', max_records: '5' })
    ).toThrow(/invalid tool arguments.*max_records.*integer/i)
  })
  it('uses Schema-required fields instead of the drifted descriptor required list', () => {
    const descriptor = getDescriptor('literature', 'openalex_get_work')!

    expect(descriptor.required).toEqual(['work_id'])
    expect(() => validateToolArguments(descriptor, {})).toThrow(/work_id.*required/i)
  })
})
