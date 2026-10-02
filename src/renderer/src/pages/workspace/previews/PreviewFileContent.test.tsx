// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewFileItem } from '@/stores/preview-workbench-store'
import type { PreviewFileRendererProps } from './preview-types'
import { createCachedImageFetchResponse } from './cached-preview-image.test-support'
import { createManagedPreviewTestTransport } from './managed-preview-test-support'
import { PreviewFileContent } from './PreviewFileContent'
import type { PreviewDownloadVersionContext } from './preview-runtime-context'

const highlightSpy = vi.hoisted(() => vi.fn())
const registerPreviewFrameSpy = vi.hoisted(() => vi.fn())

vi.mock('../preview-actions/preview-action-hooks', () => ({
  useRegisterPreviewContextMenuFrame: registerPreviewFrameSpy
}))

vi.mock('@/components/streamdown/code-highlighter-runtime', () => ({
  code: {
    supportsLanguage: (language: string) =>
      ['bash', 'css', 'javascript', 'jsx', 'python', 'r', 'typescript', 'tsx'].includes(language),
    getThemes: () => ['github-light', 'github-dark'],
    highlight: (
      options: { code: string; language: string },
      callback?: (result: { tokens: Array<Array<Record<string, unknown>>> }) => void
    ) => {
      highlightSpy(options)
      if (options.code === 'print("fresh")') {
        const staleResult = {
          tokens: [[{ content: 'print("stale")', color: '#24292f' }]]
        }
        callback?.(staleResult)
        return null
      }
      const firstToken = options.language === 'r' ? 'library' : 'import'
      const result = {
        tokens: [
          [
            {
              content: firstToken,
              color: '#0969da',
              htmlStyle: { color: '#0969da', '--shiki-dark': '#79c0ff' }
            },
            { content: options.code.slice(firstToken.length), color: '#24292f' }
          ]
        ]
      }
      callback?.(result)
      return null
    }
  }
}))

const createFileItem = (overrides: Partial<PreviewFileItem>): PreviewFileItem => ({
  id: 'file-1',
  projectId: 'project-1',
  sessionId: 'session-1',
  title: 'data.json',
  type: 'file',
  source: 'artifact',
  path: '/workspace/data.json',
  name: 'data.json',
  format: 'json',
  managedFileId: 'file-1',
  ...overrides
})

describe('PreviewFileContent', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    window.api = {
      artifacts: {
        openFile: vi.fn().mockResolvedValue(undefined),
        readPreview: vi.fn().mockResolvedValue({
          content: '',
          encoding: 'utf8',
          size: 0,
          truncated: false
        }),
        finalizeRunArtifacts: vi.fn()
      },
      uploads: {
        deleteUpload: vi.fn(),
        finalizeSession: vi.fn(),
        readPreview: vi.fn().mockResolvedValue({
          content: '',
          encoding: 'utf8',
          size: 0,
          truncated: false
        })
      }
    } as unknown as Window['api']
    const transport = createManagedPreviewTestTransport({
      read: (source, request) =>
        source === 'upload'
          ? window.api.uploads.readPreview(request)
          : window.api.artifacts.readPreview(request)
    })
    window.api.previewResources = {
      acquire: vi.fn(transport.acquire),
      readRange: vi.fn(),
      release: vi.fn(transport.release)
    }
    vi.stubGlobal('fetch', vi.fn(transport.fetch))
    vi.clearAllMocks()
    highlightSpy.mockClear()
    registerPreviewFrameSpy.mockClear()
  })

  it('downloads the selected historical version from the unsupported-preview fallback menu', async () => {
    const saveManagedFile = vi.fn().mockResolvedValue({ saved: false })
    window.api.saveManagedFile = saveManagedFile
    const unsupportedItem: PreviewFileItem = {
      id: 'upload:upload-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      title: 'archive.bin',
      type: 'file',
      source: 'upload',
      path: 'upload-version:stale-projection',
      name: 'archive.bin',
      format: 'unknown',
      managedFileId: 'upload-1',
      selectedVersionId: 'upload-v5',
      versionNumber: 5
    }

    await renderFile(unsupportedItem, {
      downloadVersionContext: {
        versionId: 'upload-v5',
        versionNumber: 5,
        latestVersionId: 'upload-v7',
        latestVersionNumber: 7
      }
    })
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Download options for archive.bin"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await Promise.resolve()
    })
    expect(saveManagedFile).not.toHaveBeenCalled()

    const selectedVersion = [
      ...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ].find((item) => item.textContent === 'Download version v5')
    expect(selectedVersion).toBeDefined()
    await act(async () => {
      selectedVersion?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(saveManagedFile).toHaveBeenCalledWith({
      source: 'upload',
      projectId: 'project-1',
      fileId: 'upload-1',
      versionId: 'upload-v5',
      suggestedName: 'archive.bin'
    })
  })

  it('does not download a managed fallback while version context is pending', async () => {
    const saveManagedFile = vi.fn().mockResolvedValue({ saved: false })
    window.api.saveManagedFile = saveManagedFile

    await renderFile(
      createFileItem({
        source: 'upload',
        projectId: 'project-1',
        managedFileId: 'upload-1',
        selectedVersionId: 'upload-v5',
        path: 'upload-version:stale-projection',
        name: 'archive.bin',
        title: 'archive.bin',
        format: 'unknown'
      })
    )

    const trigger = container.querySelector<HTMLButtonElement>('button')
    expect(trigger?.disabled).toBe(true)
    await act(async () => {
      trigger?.click()
      await Promise.resolve()
    })

    expect(saveManagedFile).not.toHaveBeenCalled()
    expect(document.body.querySelector('[role="menuitem"]')).toBeNull()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
  })

  const renderFile = async (
    item: PreviewFileItem,
    options: Omit<PreviewFileRendererProps, 'item'> & {
      downloadVersionContext?: PreviewDownloadVersionContext
      onRetry?: () => Promise<void>
    } = {}
  ): Promise<void> => {
    root = createRoot(container)
    await act(async () => {
      root.render(<PreviewFileContent item={item} {...options} />)
    })
  }

  it.each([
    ['markdown', 'notes.md'],
    ['text', 'notes.txt'],
    ['code', 'analysis.py']
  ] as const)('enables text annotations for %s previews', async (format, name) => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'selectable preview evidence',
      encoding: 'utf8',
      size: 27,
      truncated: false
    })

    await renderFile(
      createFileItem({
        format,
        name,
        projectId: 'project-1',
        selectedVersionId: 'version-2'
      }),
      { onAddAnnotation: vi.fn(() => undefined) }
    )

    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-preview-text-annotation-surface="true"]')
      ).not.toBeNull()
    )
  })

  it('waits for an Artifact Version to publish before rendering Markdown', async () => {
    vi.useFakeTimers()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(window.api.previewResources.acquire).mockRejectedValueOnce(
      new Error(
        "Error invoking remote method 'preview-resources:acquire': ManagedFileVersionError: Managed file has no published version."
      )
    )
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: '# Published report',
      encoding: 'utf8',
      size: 18,
      truncated: false
    })

    try {
      await renderFile(createFileItem({ format: 'markdown', name: 'report.md' }))

      expect(window.api.previewResources.acquire).toHaveBeenCalledOnce()
      await act(async () => vi.advanceTimersByTimeAsync(200))

      expect(container.textContent).toContain('Published report')
      expect(window.api.previewResources.acquire).toHaveBeenCalledTimes(2)
      expect(consoleError).not.toHaveBeenCalledWith(
        'Failed to read file preview',
        expect.anything()
      )
    } finally {
      consoleError.mockRestore()
      vi.useRealTimers()
    }
  })

  it('enables annotations for HTML Source but not HTML Render', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: '<main>selectable source</main>',
      encoding: 'utf8',
      size: 30,
      truncated: false
    })

    await renderFile(
      createFileItem({ format: 'html', name: 'report.html', projectId: 'project-1' }),
      { onAddAnnotation: vi.fn(() => undefined) }
    )

    expect(container.querySelector('iframe')).not.toBeNull()
    expect(container.querySelector('[data-preview-text-annotation-surface="true"]')).toBeNull()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Show HTML source"]')?.click()
    })

    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-preview-text-annotation-surface="true"]')
      ).not.toBeNull()
    )
  })

  it('does not expose text annotation surfaces for CSV previews', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'sample,value\ncontrol,1',
      encoding: 'utf8',
      size: 22,
      truncated: false
    })

    await renderFile(
      createFileItem({ format: 'csv', name: 'results.csv', projectId: 'project-1' }),
      { onAddAnnotation: vi.fn(() => undefined) }
    )

    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelector('[data-preview-text-annotation-surface="true"]')).toBeNull()
  })

  it('reuses a loaded image when its preview is unmounted and mounted again', async () => {
    const fetchImage = vi.fn().mockResolvedValue(createCachedImageFetchResponse())
    vi.stubGlobal('fetch', fetchImage)
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:cached-chart')
        static revokeObjectURL = vi.fn()
      }
    )
    const image = createFileItem({
      format: 'image',
      name: 'chart.png',
      path: '/workspace/chart.png',
      mimeType: 'image/png',
      size: 2048,
      mtimeMs: 1710000000100
    })

    await renderFile(image)
    await vi.waitFor(() => expect(container.querySelector('img')).not.toBeNull())

    await act(async () => root.render(<div />))
    await act(async () => root.render(<PreviewFileContent item={image} />))
    await vi.waitFor(() => expect(container.querySelector('img')).not.toBeNull())

    expect(window.api.previewResources.acquire).toHaveBeenCalledTimes(1)
    expect(fetchImage).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('shows the format-aware quiet progress state while a file is loading', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockReturnValue(new Promise(() => undefined))

    await renderFile(
      createFileItem({ format: 'text', name: 'notes.txt', projectId: 'project-1' }),
      { onAddAnnotation: vi.fn(() => undefined) }
    )

    const status = container.querySelector('[data-preview-status="loading"]')
    expect(status?.getAttribute('role')).toBe('status')
    expect(status?.textContent).toContain('TXT')
    expect(status?.textContent).toContain('Preparing text file')
    expect(status?.textContent).toContain('notes.txt')
    expect(status?.querySelectorAll('[data-preview-activity-dot]')).toHaveLength(3)
    expect(status?.querySelector('[data-preview-progress]')).not.toBeNull()
    expect(container.querySelector('[data-preview-text-annotation-surface="true"]')).toBeNull()
  })

  it('restarts a failed preview when Retry is selected', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(window.api.artifacts.readPreview)
      .mockRejectedValueOnce(new Error('temporary read failure'))
      .mockResolvedValueOnce({
        content: 'recovered preview',
        encoding: 'utf8',
        size: 17,
        truncated: false
      })

    await renderFile(createFileItem({ format: 'text', name: 'notes.txt' }))
    await vi.waitFor(() => expect(container.textContent).toContain("File couldn't be read"))

    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry'
    )
    expect(retry).toBeDefined()

    await act(async () => {
      retry?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() => expect(container.textContent).toContain('recovered preview'))
    expect(window.api.artifacts.readPreview).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })

  it('waits for managed logical identity refresh before restarting a failed preview', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let finishIdentityRefresh: (() => void) | undefined
    const onRetry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishIdentityRefresh = resolve
        })
    )
    vi.mocked(window.api.artifacts.readPreview)
      .mockRejectedValueOnce(new Error('stale managed identity'))
      .mockResolvedValueOnce({
        content: 'logical preview',
        encoding: 'utf8',
        size: 15,
        truncated: false
      })

    await renderFile(createFileItem({ format: 'text', name: 'notes.txt' }), { onRetry })
    await vi.waitFor(() => expect(container.textContent).toContain("File couldn't be read"))
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry'
    )

    await act(async () => {
      retry?.click()
      retry?.click()
      await Promise.resolve()
    })

    expect(onRetry).toHaveBeenCalledOnce()
    expect(window.api.artifacts.readPreview).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishIdentityRefresh?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() => expect(container.textContent).toContain('logical preview'))
    expect(window.api.artifacts.readPreview).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })

  it('retries with the refreshed logical identity instead of the stale physical path', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const legacyItem = createFileItem({
      managedFileId: undefined,
      path: '/stale/notes.txt',
      format: 'text',
      name: 'notes.txt'
    })
    const canonicalItem = {
      ...legacyItem,
      managedFileId: 'canonical-artifact-id',
      path: 'artifact-version:project-1/session-1/canonical-artifact-id/version-3'
    }
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'logical preview',
      encoding: 'utf8',
      size: 15,
      truncated: false
    })
    const RetryHarness = (): React.JSX.Element => {
      const [currentItem, setCurrentItem] = useState(legacyItem)
      return (
        <PreviewFileContent
          item={currentItem}
          onRetry={async () => setCurrentItem(canonicalItem)}
        />
      )
    }

    root = createRoot(container)
    await act(async () => root.render(<RetryHarness />))
    await vi.waitFor(() => expect(container.textContent).toContain("File couldn't be read"))
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry'
    )

    await act(async () => {
      retry?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() => expect(container.textContent).toContain('logical preview'))
    expect(window.api.previewResources.acquire).toHaveBeenCalledOnce()
    expect(window.api.previewResources.acquire).toHaveBeenCalledWith({
      source: 'artifact',
      projectId: 'project-1',
      fileId: 'canonical-artifact-id'
    })
    consoleError.mockRestore()
  })

  it('preserves the original JSON source', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: '{"name":"sample","values":[1,true]}',
      encoding: 'utf8',
      size: 36,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'json', name: 'data.json' }))

    expect(window.api.previewResources.acquire).toHaveBeenCalledWith({
      source: 'artifact',
      projectId: 'project-1',
      fileId: 'file-1'
    })
    expect(container.querySelector('pre')?.textContent).toContain('"name":"sample"')
    expect(container.querySelector('pre')?.textContent).toContain('"values":[')
  })

  it('renders line numbers next to text previews', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'alpha\nbeta',
      encoding: 'utf8',
      size: 10,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'text', name: 'notes.txt' }))

    expect(container.querySelector('[data-testid="source-line-number"]')?.textContent).toBe('1')
    expect(container.textContent).toContain('alpha')
    expect(container.textContent).toContain('beta')
  })

  it('does not run highlight byte sizing for plain text previews', async () => {
    const OriginalTextEncoder = globalThis.TextEncoder
    const textEncoderSpy = vi.fn()
    vi.stubGlobal(
      'TextEncoder',
      class extends OriginalTextEncoder {
        constructor() {
          textEncoderSpy()
          super()
        }
      }
    )
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'alpha\nbeta',
      encoding: 'utf8',
      size: 10,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'text', name: 'notes.txt' }))

    expect(textEncoderSpy).not.toHaveBeenCalled()
    expect(highlightSpy).not.toHaveBeenCalled()
  })

  it('keeps source preview line numbers inside the grid column and inherited typography', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join('\n'),
      encoding: 'utf8',
      size: 86,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'text', name: 'notes.txt' }))

    const lineNumber = container.querySelector<HTMLElement>('[data-testid="source-line-number"]')
    const row = lineNumber?.parentElement as HTMLElement | null
    expect(row?.style.gridTemplateColumns).toBe('3ch minmax(0, 1fr)')
    expect(lineNumber?.style.minWidth).toBe('')
    expect(row?.parentElement?.className).not.toContain('text-[13px]')
  })

  it('renders Python file previews with GitHub-style syntax tokens', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'import pandas as pd',
      encoding: 'utf8',
      size: 19,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'code', name: 'analysis.py' }))

    await vi.waitFor(() =>
      expect(highlightSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'import pandas as pd',
          language: 'python'
        })
      )
    )
    const token = container.querySelector('[data-testid="source-code-token"]') as HTMLElement
    expect(token?.textContent).toBe('import')
    expect(token?.style.color).toBe('rgb(9, 105, 218)')
    expect(token?.style.getPropertyValue('--shiki-dark')).toBe('#79c0ff')
    expect(container.querySelector('[data-testid="source-line-number"]')?.textContent).toBe('1')
  })

  it('renders R file previews with R syntax tokens', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'library(ggplot2)',
      encoding: 'utf8',
      size: 16,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'code', name: 'plot.r' }))

    await vi.waitFor(() =>
      expect(highlightSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'library(ggplot2)',
          language: 'r'
        })
      )
    )
  })

  it('falls back to the current source when cached highlight tokens belong to another file', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'print("fresh")',
      encoding: 'utf8',
      size: 14,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'code', name: 'analysis.py' }))

    await vi.waitFor(() => expect(highlightSpy).toHaveBeenCalled())
    expect(container.textContent).toContain('print("fresh")')
    expect(container.textContent).not.toContain('print("stale")')
    expect(container.querySelector('[data-testid="source-code-token"]')).toBeNull()
  })

  it('renders large code previews as plain source without running syntax highlighting', async () => {
    const largeSource = Array.from(
      { length: 14_000 },
      (_, index) => `import pandas as pd # ${index}`
    ).join('\n')
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: largeSource,
      encoding: 'utf8',
      size: largeSource.length,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'code', name: 'large.py' }))

    expect(container.querySelectorAll('[data-testid="source-line-number"]')).toHaveLength(2000)
    for (let page = 0; page < 6; page += 1) {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Next preview page"]')?.click()
      })
    }
    expect(container.textContent).toContain('import pandas as pd # 13999')
    expect(highlightSpy).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="source-code-token"]')).toBeNull()
  })

  it('renders a truncated TSV table with bounded rows and columns', async () => {
    const headers = Array.from({ length: 26 }, (_, index) => `column-${index + 1}`)
    const rows = Array.from({ length: 101 }, (_, rowIndex) =>
      headers.map((_, columnIndex) => `r${rowIndex + 1}c${columnIndex + 1}`).join('\t')
    )
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: [headers.join('\t'), ...rows].join('\n'),
      encoding: 'utf8',
      size: 10_000,
      truncated: true
    })

    await renderFile(createFileItem({ format: 'csv', name: 'measurements.tsv' }))

    expect(container.textContent).not.toContain('100+ rows · 26 columns')
    expect(container.textContent).not.toContain('100 rows · 26 columns')
    expect(container.textContent).toContain('Showing 100 rows · 24 columns')
    expect(container.textContent).toContain('2 more columns hidden in this preview')
    expect(container.textContent).toContain('r1c1')
    expect(container.textContent).not.toContain('r101c1')
  })

  it('shows the parser error without discarding CSV rows that can still be previewed', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'sample,value\ncontrol,1\n"incomplete,2',
      encoding: 'utf8',
      size: 37,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'csv', name: 'results.csv' }))

    expect(container.textContent).toContain('control')
    expect(container.querySelector('.text-danger-000')?.textContent).not.toBe('')
  })

  it('loads the next bounded page of a large text preview on demand', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockImplementation(async (request) =>
      request.offset === 5
        ? ({
            content: 'second page',
            encoding: 'utf8',
            size: 16,
            offset: 5,
            truncated: false
          } as never)
        : ({
            content: 'first',
            encoding: 'utf8',
            size: 16,
            offset: 0,
            nextOffset: 5,
            truncated: true
          } as never)
    )

    await renderFile(
      createFileItem({ format: 'text', name: 'large.txt', path: '/workspace/large.txt' })
    )
    expect(container.textContent).toContain('first')

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Next preview page"]')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenLastCalledWith(
      'open-science-preview://resource-1/file-1',
      expect.objectContaining({ headers: { Range: expect.stringMatching(/^bytes=5-/u) } })
    )
    expect(container.textContent).toContain('second page')
    expect(container.textContent).not.toContain('first')
  })

  // Degradation for design §20.4: a session-referenced file deleted from disk (or on a
  // disconnected drive) must surface a handled "unavailable" state instead of crashing or
  // blanking - readManagedFilePreview rejects with ENOENT, and the renderer must catch it.
  it('shows an unavailable message instead of crashing when the file no longer exists on disk', async () => {
    const enoent = Object.assign(new Error('ENOENT: no such file or directory'), {
      code: 'ENOENT'
    })
    vi.mocked(window.api.artifacts.readPreview).mockRejectedValue(enoent)

    await renderFile(
      createFileItem({ format: 'text', name: 'gone.txt', path: '/workspace/gone.txt' })
    )

    expect(container.textContent).toContain('This file is no longer available')
    expect(container.querySelector('pre')).toBeNull()

    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry'
    )
    expect(retry).toBeDefined()

    await act(async () => {
      retry?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(window.api.artifacts.readPreview).toHaveBeenCalledTimes(2)
    expect(window.api.artifacts.openFile).not.toHaveBeenCalled()
  })

  it('reacquires an expired preview after a protocol 404 without reporting a missing file', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }))
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: 'Recovered preview',
      encoding: 'utf8',
      size: 17,
      truncated: false
    })

    await renderFile(
      createFileItem({ format: 'text', name: 'gone.txt', path: '/workspace/gone.txt' })
    )

    expect(container.textContent).not.toContain('This file is no longer available')
    expect(container.textContent).toContain("File couldn't be read")
    expect(container.querySelector('pre')).toBeNull()
    expect(window.api.previewResources.release).toHaveBeenCalledWith({
      resourceId: 'resource-1'
    })
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry'
    )
    expect(retry).toBeDefined()
    await act(async () => retry!.click())
    await vi.waitFor(() => expect(container.textContent).toContain('Recovered preview'))
    expect(window.api.previewResources.acquire).toHaveBeenCalledTimes(2)

    consoleError.mockRestore()
  })

  it('renders line numbers next to original JSON previews', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: '{"name":"sample","values":[1,true]}',
      encoding: 'utf8',
      size: 36,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'json', name: 'data.json' }))

    expect(container.querySelector('[data-testid="source-line-number"]')?.textContent).toBe('1')
    expect(container.textContent).toContain('"name":"sample"')
  })

  it('uses paged source instead of parsing truncated JSON', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: '{"partial":',
      encoding: 'utf8',
      size: 20,
      offset: 0,
      nextOffset: 11,
      truncated: true
    })

    await renderFile(createFileItem({ format: 'json', name: 'large.json' }))

    expect(container.querySelector('[aria-label="Next preview page"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="source-line-number"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Invalid JSON')
  })

  it('uses paged source instead of rich rendering for truncated Markdown', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: '# Partial report',
      encoding: 'utf8',
      size: 40,
      offset: 0,
      nextOffset: 16,
      truncated: true
    })

    await renderFile(createFileItem({ format: 'markdown', name: 'large.md' }))

    expect(container.querySelector('[aria-label="Next preview page"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="source-line-number"]')).not.toBeNull()
  })

  it('renders HTML from a managed stream inside a script sandbox', async () => {
    await renderFile(createFileItem({ format: 'html', name: 'report.html' }))

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts')
    expect(iframe?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(iframe?.getAttribute('src')).toBe('open-science-preview://resource-1/file-1')
    expect(iframe?.hasAttribute('srcdoc')).toBe(false)
    expect(window.api.artifacts.readPreview).not.toHaveBeenCalled()
    expect(registerPreviewFrameSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        frameUrl: 'open-science-preview://resource-1/file-1',
        enabled: true,
        frameRef: expect.objectContaining({ current: iframe })
      })
    )
  })

  it.each(['artifact', 'upload'] as const)(
    'keeps the HTML %s preview usable when its logical identity is missing',
    async (source) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await renderFile(
        createFileItem({
          id: source === 'upload' ? 'upload:legacy-html' : 'legacy-artifact-version',
          source,
          format: 'html',
          name: 'legacy.html',
          title: 'legacy.html',
          path: '/managed/must-not-be-read-by-path/legacy.html',
          managedFileId: undefined
        })
      )

      expect(container.querySelector('iframe')).toBeNull()
      expect(container.textContent).toContain("HTML couldn't be read for preview")
      expect(container.querySelector('[aria-label="Show rendered HTML"]')).not.toBeNull()
      expect(container.querySelector('[aria-label="Show HTML source"]')).not.toBeNull()
      expect(window.api.previewResources.acquire).not.toHaveBeenCalled()
      expect(window.api.artifacts.readPreview).not.toHaveBeenCalled()
      expect(window.api.uploads.readPreview).not.toHaveBeenCalled()

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Show HTML source"]')?.click()
      })

      await vi.waitFor(() =>
        expect(
          container.querySelector('[aria-label="Show HTML source"]')?.getAttribute('aria-pressed')
        ).toBe('true')
      )
      expect(container.textContent).toContain("HTML couldn't be read for preview")
      expect(window.api.previewResources.acquire).not.toHaveBeenCalled()
      expect(window.api.artifacts.readPreview).not.toHaveBeenCalled()
      expect(window.api.uploads.readPreview).not.toHaveBeenCalled()

      consoleError.mockRestore()
    }
  )

  it('falls back when the managed HTML URL cannot be loaded', async () => {
    await renderFile(createFileItem({ format: 'html', name: 'report.html' }))
    const iframe = container.querySelector('iframe')

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'open-science-preview-load-error',
          source: iframe?.contentWindow ?? null
        })
      )
    })

    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toContain("HTML couldn't be read for preview")
    expect(window.api.previewResources.release).toHaveBeenCalledWith({
      resourceId: 'resource-1'
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Show HTML source"]')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(window.api.artifacts.readPreview).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'file-1', projectId: 'project-1', offset: 0 })
    )
  })

  it('can switch HTML previews to numbered source', async () => {
    vi.mocked(window.api.artifacts.readPreview).mockResolvedValue({
      content: '<!doctype html>\n<h1>Report</h1>',
      encoding: 'utf8',
      size: 31,
      truncated: false
    })

    await renderFile(createFileItem({ format: 'html', name: 'report.html' }))

    vi.mocked(window.api.artifacts.readPreview).mockClear()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Show HTML source"]')?.click()
    })

    expect(container.querySelector('[data-testid="source-line-number"]')?.textContent).toBe('1')
    expect(container.textContent).toContain('<h1>Report</h1>')
    expect(window.api.artifacts.readPreview).toHaveBeenCalledTimes(1)
    expect(registerPreviewFrameSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ frameUrl: '', enabled: false })
    )
  })

  it('reads upload-sourced text previews through a managed upload resource', async () => {
    vi.mocked(window.api.uploads.readPreview).mockResolvedValue({
      content: 'uploaded content',
      encoding: 'utf8',
      size: 16,
      truncated: false
    })

    await renderFile(
      createFileItem({
        id: 'upload:file-1',
        source: 'upload',
        format: 'text',
        name: 'notes.txt',
        path: '/Users/example/.open-science/uploads/default-project/session-1/notes.txt'
      })
    )

    expect(window.api.previewResources.acquire).toHaveBeenCalledWith({
      source: 'upload',
      projectId: 'project-1',
      fileId: 'file-1'
    })
    expect(window.api.artifacts.readPreview).not.toHaveBeenCalled()
    expect(container.textContent).toContain('uploaded content')
  })
})
