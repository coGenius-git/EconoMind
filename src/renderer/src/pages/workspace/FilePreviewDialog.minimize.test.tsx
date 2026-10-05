// @vitest-environment jsdom
import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PreviewFileItem } from '@/stores/preview-workbench-store'

const unmount = vi.fn()
vi.mock('./PreviewFileSurface', () => ({
  PreviewFileSurface: ({ onMinimize }: { onMinimize: () => void }) => {
    const [draft, setDraft] = useState('reading note')
    useEffect(() => unmount, [])
    return (
      <>
        <input
          aria-label="Reading note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button onClick={onMinimize}>Hide preview</button>
      </>
    )
  }
}))
import { FilePreviewDialog } from './FilePreviewDialog'

const item: PreviewFileItem = {
  id: 'paper-1',
  sessionId: 'session-1',
  type: 'file',
  title: 'paper.pdf',
  name: 'paper.pdf',
  path: '/project/paper.pdf',
  format: 'pdf',
  source: 'artifact'
}
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  container.id = 'root'
  document.body.appendChild(container)
  root = createRoot(container)
  unmount.mockClear()
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('returns to Home and restores the same mounted preview without closing it', async () => {
  const onClose = vi.fn()
  const onMinimize = vi.fn()
  const backgroundAction = vi.fn()
  await act(async () =>
    root.render(
      <>
        <button id="home-action" onClick={backgroundAction}>
          Home action
        </button>
        <FilePreviewDialog item={item} onClose={onClose} onMinimize={onMinimize} />
      </>
    )
  )
  const note = document.querySelector<HTMLInputElement>('input[aria-label="Reading note"]')!
  expect(container.inert).toBe(true)
  await act(async () => {
    Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent === 'Hide preview')!
      .click()
  })
  expect(container.inert).toBe(false)
  expect(container.hasAttribute('aria-hidden')).toBe(false)
  expect(
    document.querySelector<HTMLElement>('[data-slot="file-preview-dialog"]')?.style.display
  ).toBe('none')
  await act(async () => container.querySelector<HTMLButtonElement>('#home-action')!.click())
  expect(backgroundAction).toHaveBeenCalledOnce()
  expect(onClose).not.toHaveBeenCalled()
  expect(onMinimize).toHaveBeenCalledOnce()
  expect(unmount).not.toHaveBeenCalled()
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('button[aria-label="Restore preview of paper.pdf"]')!
      .click()
  })
  expect(container.inert).toBe(true)
  expect(document.querySelector('input[aria-label="Reading note"]')).toBe(note)
  expect(note.value).toBe('reading note')
  expect(unmount).not.toHaveBeenCalled()
})

it('clears a minimized preview when the owner closes it, so reopening is visible', async () => {
  const render = async (value: PreviewFileItem | undefined): Promise<void> => {
    await act(async () => root.render(<FilePreviewDialog item={value} onClose={vi.fn()} />))
  }
  await render(item)
  await act(async () => {
    Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent === 'Hide preview')!
      .click()
  })
  await render(undefined)
  await render(item)
  expect(
    document.querySelector<HTMLElement>('[data-slot="file-preview-dialog"]')?.style.display
  ).not.toBe('none')
  expect(container.inert).toBe(true)
})
