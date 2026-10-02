// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreeningWordPreview } from './ScreeningWordPreview'

const mocks = vi.hoisted(() => ({ validate: vi.fn(), render: vi.fn(), dispose: vi.fn() }))
vi.mock('../workspace/previews/office-package', () => ({ validateOfficePackage: mocks.validate }))
vi.mock('../workspace/previews/office-renderers', () => ({ renderOfficeFile: mocks.render }))
const bytes = new Uint8Array([80, 75])
beforeEach(() => {
  mocks.validate.mockReset().mockResolvedValue(undefined)
  mocks.dispose.mockReset()
  mocks.render.mockReset().mockImplementation(async ({ container }) => {
    const page = container.ownerDocument.createElement('section')
    page.className = 'docx'
    page.style.width = '816px'
    page.textContent = 'Rendered Word content'
    container.appendChild(page)
    return mocks.dispose
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const loadFrame = (): HTMLIFrameElement => {
  const frame = screen.getByTitle('Preview of report.docx') as HTMLIFrameElement
  fireEvent.load(frame)
  return frame
}

describe('screening Word page preview', () => {
  it('validates and renders the actual bytes in an isolated frame with zoom controls', async () => {
    const { unmount } = render(<ScreeningWordPreview bytes={bytes} name="report.docx" />)
    const frame = loadFrame()
    await waitFor(() => expect(mocks.render).toHaveBeenCalledOnce())
    await waitFor(() => expect(frame.style.visibility).toBe('visible'))
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin')
    expect(mocks.validate).toHaveBeenCalledWith(bytes, 'docx', expect.any(AbortSignal))
    expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({ bytes, fitToWidth: false }))
    const before = Number(screen.getByRole('status').textContent?.replace('%', ''))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(Number(screen.getByRole('status').textContent?.replace('%', ''))).toBe(before + 10)
    fireEvent.click(screen.getByRole('button', { name: 'Fit to width' }))
    expect(Number(screen.getByRole('status').textContent?.replace('%', ''))).toBe(before)
    unmount()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('blocks invalid Word packages and allows retry', async () => {
    mocks.validate.mockRejectedValueOnce(new Error('Invalid package'))
    render(<ScreeningWordPreview bytes={bytes} name="report.docx" />)
    const frame = loadFrame()
    expect(await screen.findByRole('alert')).not.toBeNull()
    expect(mocks.render).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(frame.style.visibility).toBe('visible'))
  })
  it('disposes an obsolete render that finishes after the file is switched', async () => {
    let resolveOld!: (dispose: () => void) => void
    mocks.render.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        })
    )
    const { rerender } = render(<ScreeningWordPreview bytes={bytes} name="report.docx" />)
    const frame = loadFrame()
    await waitFor(() => expect(mocks.render).toHaveBeenCalledOnce())
    rerender(<ScreeningWordPreview bytes={new Uint8Array([1, 2, 3])} name="report.docx" />)
    await waitFor(() => expect(frame.style.visibility).toBe('visible'))
    const obsoleteDispose = vi.fn()
    resolveOld(obsoleteDispose)
    await waitFor(() => expect(obsoleteDispose).toHaveBeenCalledOnce())
    expect(frame.style.visibility).toBe('visible')
    expect(mocks.dispose).not.toHaveBeenCalled()
  })
})
