import { describe, expect, it, vi, type Mock } from 'vitest'

import {
  selectCredentialIdentity,
  type CredentialIdentity,
  type IdentityProbeResult
} from './selection'

const result = (status: IdentityProbeResult['status']): IdentityProbeResult => ({ status })
const choose = (
  statuses: IdentityProbeResult['status'][],
  packaged = true
): { selection: CredentialIdentity; probe: Mock<() => IdentityProbeResult> } => {
  const probe = vi.fn(() => result(statuses.shift() ?? 'not-found'))
  return { selection: selectCredentialIdentity({ platform: 'darwin', packaged, probe }), probe }
}

describe('credential identity selection', () => {
  const statuses = ['exists', 'not-found', 'access-blocked', 'error', 'unsupported'] as const
  it.each([true, false])(
    'selects sequentially for all status triples (packaged=%s)',
    (packaged) => {
      const suffix = packaged ? '' : ' (DEV)'
      const names = [`EconoMind${suffix}`, `Open-Science${suffix}`, `Open Science${suffix}`]
      for (const preferred of statuses) {
        for (const previous of statuses) {
          for (const oldest of statuses) {
            const states = [preferred, previous, oldest]
            const confirmed = states.indexOf('exists')
            const { selection, probe } = choose([...states], packaged)
            expect(selection).toEqual({
              backend: 'mac-keychain',
              appName: names[confirmed < 0 ? 0 : confirmed],
              exists: confirmed >= 0
            })
            expect(probe.mock.calls).toEqual(
              names.slice(0, confirmed < 0 ? 3 : confirmed + 1).map((name) => [name])
            )
          }
        }
      }
    }
  )

  it.each([true, false])('continues after thrown probes (legacy exists=%s)', (legacyExists) => {
    const probe = vi.fn<() => IdentityProbeResult>(() => {
      throw new Error('password=PRIVATE-ERROR')
    })
    if (legacyExists)
      probe
        .mockImplementationOnce(() => {
          throw new Error('PRIVATE-ERROR')
        })
        .mockImplementationOnce(() => ({ status: 'exists' }))
    expect(selectCredentialIdentity({ platform: 'darwin', packaged: true, probe })).toEqual({
      backend: 'mac-keychain',
      appName: legacyExists ? 'Open-Science' : 'EconoMind',
      exists: legacyExists
    })
    expect(probe.mock.calls).toEqual(
      legacyExists
        ? [['EconoMind'], ['Open-Science']]
        : [['EconoMind'], ['Open-Science'], ['Open Science']]
    )
  })

  it('does not cache a legacy selection across launches', () => {
    expect(choose(['not-found', 'exists']).selection.appName).toBe('Open-Science')
    expect(choose(['not-found', 'not-found', 'exists']).selection.appName).toBe('Open Science')
    expect(choose(['exists']).selection.appName).toBe('EconoMind')
  })

  it('keeps Windows on the same profile-scoped DPAPI backend without macOS item queries', () => {
    const probe = vi.fn()
    const selection = selectCredentialIdentity({ platform: 'win32', packaged: true, probe })
    expect(selection).toEqual({ backend: 'windows-dpapi', appName: 'EconoMind' })
    expect(probe).not.toHaveBeenCalled()
  })

  it('requires a Linux metadata adapter without calling the macOS probe, and preserves file mode', () => {
    const probe = vi.fn()
    expect(() => selectCredentialIdentity({ platform: 'linux', packaged: true, probe })).toThrow(
      /credential/i
    )
    expect(
      selectCredentialIdentity({
        platform: 'linux',
        packaged: true,
        credentialStore: 'file',
        probe
      })
    ).toEqual({ backend: 'file', appName: 'EconoMind' })
    const linuxProbe = vi.fn(() => ({ status: 'exists' as const }))
    expect(
      selectCredentialIdentity({ platform: 'linux', packaged: true, probe, linuxProbe })
    ).toEqual({ backend: 'linux-secret-service', appName: 'EconoMind', exists: true })
    expect(linuxProbe).toHaveBeenCalledExactlyOnceWith('EconoMind')
    expect(probe).not.toHaveBeenCalled()
  })

  it.each([true, false])('reuses the historical Linux identity (packaged=%s)', (packaged) => {
    const suffix = packaged ? '' : ' (DEV)'
    const probe = vi.fn()
    const linuxProbe = vi.fn((appName: string) => ({
      status: appName === `Open Science${suffix}` ? ('exists' as const) : ('not-found' as const)
    }))
    expect(selectCredentialIdentity({ platform: 'linux', packaged, probe, linuxProbe })).toEqual({
      backend: 'linux-secret-service',
      appName: `Open Science${suffix}`,
      exists: true
    })
    expect(linuxProbe.mock.calls).toEqual([[`EconoMind${suffix}`], [`Open Science${suffix}`]])
    expect(probe).not.toHaveBeenCalled()
  })

  it.each(['access-blocked', 'error', 'unsupported'] as const)(
    'does not replace an unconfirmed Linux identity after %s',
    (status) => {
      const linuxProbe = vi.fn(() => ({ status }))
      expect(() =>
        selectCredentialIdentity({ platform: 'linux', packaged: true, probe: vi.fn(), linuxProbe })
      ).toThrow(/recovery/i)
      expect(linuxProbe).toHaveBeenCalledExactlyOnceWith('EconoMind')
    }
  )

  it.each(['access-blocked', 'error', 'unsupported'] as const)(
    'does not initialize a new Linux key when the historical key is %s',
    (status) => {
      const linuxProbe = vi.fn((appName: string) => ({
        status: appName === 'EconoMind' ? ('not-found' as const) : status
      }))
      expect(() =>
        selectCredentialIdentity({ platform: 'linux', packaged: true, probe: vi.fn(), linuxProbe })
      ).toThrow(/recovery/i)
      expect(linuxProbe.mock.calls).toEqual([['EconoMind'], ['Open Science']])
    }
  )

  it('uses EconoMind for a fresh Linux identity only after both names are absent', () => {
    const linuxProbe = vi.fn(() => ({ status: 'not-found' as const }))
    expect(
      selectCredentialIdentity({ platform: 'linux', packaged: true, probe: vi.fn(), linuxProbe })
    ).toEqual({ backend: 'linux-secret-service', appName: 'EconoMind', exists: false })
    expect(linuxProbe.mock.calls).toEqual([['EconoMind'], ['Open Science']])
  })
})
