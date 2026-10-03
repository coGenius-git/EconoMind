import { describe, expect, it, vi } from 'vitest'
import { DestinationPolicy } from '../../packages/notebook-network-sandbox/runtime/src/gateway/address-policy'
import { createRuntimeConfig } from '../../packages/notebook-network-sandbox/src/config'

import {
  DEFAULT_NOTEBOOK_NETWORK_SETTINGS,
  buildNotebookNetworkPolicy,
  normalizeNotebookNetworkSettings,
  notebookNetworkSettingsAllowDomain,
  validateCustomAllowedDomain
} from './notebook-network'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '8.8.8.8', family: 4 }])
}))

describe('disabled automatic domain access', () => {
  it.each([
    ['api.worldbank.org', 'api.worldbank.org', 'data.worldbank.org'],
    ['data.stats.gov.cn', 'data.stats.gov.cn', 'www.stats.gov.cn'],
    ['data.sec.gov', 'data.sec.gov', 'www.sec.gov']
  ])('asks for %s while retaining other built-in hosts', async (disabled, host, sibling) => {
    const settings = normalizeNotebookNetworkSettings({ disabledOpenScienceDomains: [disabled] })
    const inspect = (value: typeof settings): DestinationPolicy =>
      new DestinationPolicy(
        createRuntimeConfig({
          policy: buildNotebookNetworkPolicy(value),
          resources: { root: '/resources' }
        })
      )

    expect
      .soft(await inspect(settings).inspect(host, 443))
      .toMatchObject({ kind: 'ask', source: 'explicit', host })
    expect.soft(notebookNetworkSettingsAllowDomain(settings, host)).toBe(false)
    expect(await inspect(settings).inspect(sibling, 443)).toMatchObject({ kind: 'allow' })

    // A later explicit approval remains effective; turning off auto-allow is not a permanent ban.
    const approved = { ...settings, allowedDomains: [host] }
    expect(await inspect(approved).inspect(host, 443)).toMatchObject({ kind: 'allow' })
    expect(notebookNetworkSettingsAllowDomain(approved, host)).toBe(true)
  })
})

describe('notebook network policy', () => {
  it('enables every EconoMind domain group by default', () => {
    const policy = buildNotebookNetworkPolicy(DEFAULT_NOTEBOOK_NETWORK_SETTINGS)

    expect(policy.allowedDomains).toContain('pypi.org')
    expect(policy.allowedDomains).toContain('api.worldbank.org')
    expect(policy.allowedDomains).toContain('data.sec.gov')
  })

  it('removes natural-science defaults and safely normalizes legacy preferences', () => {
    const settings = normalizeNotebookNetworkSettings({
      disabledOpenScienceDomainGroups: ['nih', 'genomics', 'proteomics', 'clinical', 'literature'],
      disabledOpenScienceDomains: ['rest.uniprot.org'],
      allowedDomains: ['explicit.example.org']
    })
    expect(settings.disabledOpenScienceDomainGroups).toEqual(['literature'])
    expect(settings.disabledOpenScienceDomains).toEqual([])
    expect(settings.allowedDomains).toEqual(['explicit.example.org'])
    for (const host of [
      'www.ncbi.nlm.nih.gov',
      'rest.uniprot.org',
      'clinicaltrials.gov',
      'api.biorxiv.org',
      'bioconductor.org'
    ]) {
      expect(notebookNetworkSettingsAllowDomain(settings, host)).toBe(false)
    }
    for (const host of [
      'data.stats.gov.cn',
      'api.worldbank.org',
      'api.stlouisfed.org',
      'www.pbc.gov.cn',
      'data.sec.gov',
      'www.cninfo.com.cn'
    ]) {
      expect(notebookNetworkSettingsAllowDomain(settings, host)).toBe(true)
    }
  })

  it('removes disabled groups and individual built-in domains', () => {
    const policy = buildNotebookNetworkPolicy({
      allowedDomains: ['research.example'],
      disabledOpenScienceDomainGroups: ['literature'],
      disabledOpenScienceDomains: ['api.worldbank.org']
    })

    expect(policy.allowedDomains).toContain('research.example')
    expect(policy.allowedDomains).not.toContain('api.crossref.org')
    expect(policy.allowedDomains).not.toContain('api.worldbank.org')
  })

  it('keeps the required package-registry group enabled', () => {
    const settings = normalizeNotebookNetworkSettings({
      disabledOpenScienceDomainGroups: ['packageRegistries'],
      disabledOpenScienceDomains: ['pypi.org']
    })

    expect(settings.disabledOpenScienceDomainGroups).toEqual([])
    expect(settings.disabledOpenScienceDomains).toEqual([])
    expect(buildNotebookNetworkPolicy(settings).allowedDomains).toContain('pypi.org')
  })

  it('allows only catalogued package-mirror redirect hosts', () => {
    const policy = buildNotebookNetworkPolicy(DEFAULT_NOTEBOOK_NETWORK_SETTINGS)

    expect(policy.allowedDomains).toContain('mirrors.nju.edu.cn')
    expect(policy.allowedDomains).not.toContain('redirect.example')
  })

  it('rejects URLs, wildcards, local targets, IP literals, and single-label domains', () => {
    expect(validateCustomAllowedDomain('https://example.com')).toEqual({
      ok: false,
      reason: 'format'
    })
    expect(validateCustomAllowedDomain('*.example.com')).toEqual({ ok: false, reason: 'format' })
    expect(validateCustomAllowedDomain('localhost')).toEqual({ ok: false, reason: 'reserved' })
    expect(validateCustomAllowedDomain('127.0.0.1')).toEqual({ ok: false, reason: 'reserved' })
    expect(validateCustomAllowedDomain('intranet')).toEqual({ ok: false, reason: 'format' })
    expect(validateCustomAllowedDomain('hooks.slack.com')).toEqual({
      ok: true,
      hostname: 'hooks.slack.com'
    })
  })

  it('normalizes safe international and case-variant hostnames', () => {
    expect(validateCustomAllowedDomain('DATA.Example.COM')).toEqual({
      ok: true,
      hostname: 'data.example.com'
    })
    expect(validateCustomAllowedDomain('例子.测试')).toEqual({
      ok: true,
      hostname: 'xn--fsqu00a.xn--0zwm56d'
    })
  })

  it('sanitizes persisted settings and preserves only known built-in switches', () => {
    expect(
      normalizeNotebookNetworkSettings({
        allowedDomains: ['DATA.Example.COM', 'localhost', 'data.example.com'],
        disabledOpenScienceDomainGroups: ['literature', 'unknown'],
        disabledOpenScienceDomains: ['api.worldbank.org', 'unknown.example']
      })
    ).toEqual({
      allowedDomains: ['data.example.com'],
      disabledOpenScienceDomainGroups: ['literature'],
      disabledOpenScienceDomains: ['api.worldbank.org']
    })
  })

  it('does not give unknown public reads persistent target or preview permission', async () => {
    const settings = DEFAULT_NOTEBOOK_NETWORK_SETTINGS
    const policy = buildNotebookNetworkPolicy(settings)
    const destination = new DestinationPolicy(policy)

    expect(await destination.inspect('unknown.research.example', 443)).toMatchObject({
      kind: 'ask',
      source: 'unknown'
    })
    expect(notebookNetworkSettingsAllowDomain(settings, 'unknown.research.example')).toBe(false)
    expect(buildNotebookNetworkPolicy(settings)).toEqual(policy)
  })

  it('leaves public domains to request inspection and target approval', () => {
    const policy = buildNotebookNetworkPolicy(DEFAULT_NOTEBOOK_NETWORK_SETTINGS)

    expect(policy.deniedDomains).toEqual([])
    expect(policy.deniedDomainReasons).toEqual({})
  })
})
