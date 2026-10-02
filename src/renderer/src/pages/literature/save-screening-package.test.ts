// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WEB_CALLER_LOCATION_ATTRIBUTE } from '../../../../shared/web-caller-location'
import { saveScreeningPackage } from './save-screening-package'

beforeEach(() => document.documentElement.setAttribute(WEB_CALLER_LOCATION_ATTRIBUTE, 'local'))
afterEach(() => {
  document.documentElement.removeAttribute(WEB_CALLER_LOCATION_ATTRIBUTE)
  vi.unstubAllGlobals()
})

describe('evidence package save as', () => {
  it('does not generate or download a package if the user cancels the picker', async () => {
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    )
    const prepare = vi.fn()
    await expect(saveScreeningPackage('Review', prepare)).resolves.toEqual({ saved: false })
    expect(prepare).not.toHaveBeenCalled()
  })
  it('explains unsupported browsers instead of silently downloading', async () => {
    vi.stubGlobal('showSaveFilePicker', undefined)
    const prepare = vi.fn()
    await expect(saveScreeningPackage('Review', prepare)).rejects.toThrow(
      'cannot choose a save location'
    )
    expect(prepare).not.toHaveBeenCalled()
  })
  it('does not open the destination for writing if export validation fails', async () => {
    const createWritable = vi.fn()
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => ({ name: 'evidence.zip', createWritable }))
    )
    await expect(
      saveScreeningPackage('Review', async () => {
        throw new Error('Review changed')
      })
    ).rejects.toThrow('Review changed')
    expect(createWritable).not.toHaveBeenCalled()
  })
  it('aborts failed writes and never reports success', async () => {
    const write = vi.fn().mockRejectedValue(new Error('disk full')),
      close = vi.fn(),
      abort = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => ({
        name: 'evidence.zip',
        createWritable: async () => ({ write, close, abort })
      }))
    )
    await expect(
      saveScreeningPackage('Review', async () => ({
        filename: 'evidence.zip',
        base64: btoa('zip'),
        files: []
      }))
    ).rejects.toThrow('disk full')
    expect(abort).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
  })
})
