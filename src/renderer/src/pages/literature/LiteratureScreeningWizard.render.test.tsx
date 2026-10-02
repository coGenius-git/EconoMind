// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  screeningWorkflowSchema,
  type ScreeningRequest,
  type ScreeningWorkflow
} from '../../../../shared/literature-screening'
import { LiteratureScreeningWizard } from './LiteratureScreeningWizard'
import { ScreeningReview } from './ScreeningReview'
import { ScreeningSetup, ScreeningExport } from './ScreeningForms'
import { buildScreeningExport } from '../../../../main/literature/screening-export'
import { WEB_CALLER_LOCATION_ATTRIBUTE } from '../../../../shared/web-caller-location'

const { pdf, rpc } = vi.hoisted(() => ({ pdf: vi.fn(), rpc: vi.fn() }))
vi.mock('../workspace/previews/renderers/PdfPreview', () => ({
  PdfPreviewContent: (props: unknown) => {
    pdf(props)
    return <div data-testid="pdf-reader" />
  }
}))
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />
}))
const fixture = (): ScreeningWorkflow =>
  screeningWorkflowSchema.parse({
    schemaVersion: 1,
    id: '6b825e10-2902-4f20-8884-9a97b5cb1f20',
    projectId: 'project',
    config: {
      name: 'Financing review',
      topic: 'Finance',
      inclusion: 'Firms',
      exclusion: 'Households',
      concepts: [],
      relations: [],
      viewpoints: ['Mechanisms']
    },
    revision: 1,
    stage: 3,
    parseConfirmed: true,
    screeningConfirmed: false,
    extractionConfirmed: false,
    documents: [
      {
        id: 'paper',
        title: 'A test paper',
        authors: 'Author',
        year: 2024,
        doi: '',
        attachmentVersionId: 'version-1',
        filename: 'paper.pdf',
        parseStatus: 'done',
        screeningStatus: 'done',
        extractionStatus: 'pending',
        suggestion: 'included',
        reason: 'Within scope',
        evidence: [{ quote: 'Verified evidence', page: 3, matched: true }]
      }
    ],
    runs: [],
    history: [],
    createdAt: 1,
    updatedAt: 1
  })
beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ pages: [] })
  pdf.mockClear()
  localStorage.clear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { literature: { screening: rpc, search: vi.fn(async () => ({ entries: [] })) } }
  })
})
afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute(WEB_CALLER_LOCATION_ATTRIBUTE)
  vi.unstubAllGlobals()
})
describe('screening workbench', () => {
  it('explains unfinished results in a dialog and continues into native Save As with the project name', async () => {
    const w = fixture()
    w.screeningConfirmed = true
    w.documents[0].decision = 'included'
    const save = vi.fn(async () => ({ saved: true, filePath: 'D:\\Desktop\\实际项目证据包.zip' }))
    window.api.saveBlobFile = save
    const mutate = vi.fn(async () => ({
      export: { filename: 'old-timestamp.zip', base64: btoa('zip'), files: [] }
    }))
    render(<ScreeningExport workflow={w} projectName="实际项目" disabled={false} mutate={mutate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save evidence package as…' }))
    expect(screen.getByRole('alertdialog')).not.toBeNull()
    expect(mutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Save As' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ partial: true, preview: false }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: '实际项目证据包.zip', defaultDirectory: 'desktop' })
    )
  })
  it('opens the browser save picker before generating the package and writes to the chosen file', async () => {
    document.documentElement.setAttribute(WEB_CALLER_LOCATION_ATTRIBUTE, 'local')
    const write = vi.fn(),
      close = vi.fn(),
      abort = vi.fn()
    const picker = vi.fn(async () => ({
      name: 'chosen.zip',
      createWritable: async () => ({ write, close, abort })
    }))
    vi.stubGlobal('showSaveFilePicker', picker)
    const save = vi.fn()
    window.api.saveBlobFile = save
    const w = fixture()
    w.screeningConfirmed = w.extractionConfirmed = true
    w.documents[0].decision = 'included'
    w.documents[0].extractionStatus = 'done'
    const mutate = vi.fn(async () => {
      expect(picker).toHaveBeenCalledOnce()
      return { export: { filename: 'evidence.zip', base64: btoa('zip bytes'), files: [] } }
    })
    render(<ScreeningExport workflow={w} disabled={false} mutate={mutate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save evidence package as…' }))
    expect(picker).toHaveBeenCalledOnce()
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(write).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled()
    expect(abort).not.toHaveBeenCalled()
    expect(await screen.findByText('Saved to: chosen.zip')).not.toBeNull()
  })
  it('uses the native save command and only reports completion after a successful save', async () => {
    const w = fixture()
    w.screeningConfirmed = true
    w.extractionConfirmed = true
    w.documents[0].decision = 'included'
    w.documents[0].extractionStatus = 'done'
    const save = vi
      .fn()
      .mockResolvedValueOnce({ saved: false })
      .mockResolvedValueOnce({ saved: true })
    window.api.saveBlobFile = save
    const mutate = vi.fn(async () => ({
      export: { filename: 'evidence.zip', base64: btoa('test bytes'), files: ['report.docx'] }
    }))
    render(<ScreeningExport workflow={w} disabled={false} mutate={mutate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save evidence package as…' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(screen.queryByText('Export complete')).toBeNull()
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save evidence package as…' }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save evidence package as…' }))
    expect(await screen.findByText('Export complete')).not.toBeNull()
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedName: 'Financing review证据包.zip',
        mimeType: 'application/zip',
        defaultDirectory: 'desktop'
      })
    )
  })
  it('does not fetch anything while closed', () => {
    render(
      <LiteratureScreeningWizard
        open={false}
        onClose={() => undefined}
        reviewProjectId="project"
        scope={{ projectId: 'project' }}
      />
    )
    expect(rpc).not.toHaveBeenCalled()
  })
  it('opens a saved task and keeps unconfirmed later stages locked', async () => {
    const w = fixture()
    w.documents.push({ ...w.documents[0], id: 'resolved', decision: 'included' })
    rpc.mockImplementation(async (request: ScreeningRequest) =>
      request.action === 'list'
        ? { workflows: [{ ...w, total: 1 }] }
        : request.action === 'get'
          ? { workflow: w }
          : { pages: [] }
    )
    render(
      <LiteratureScreeningWizard
        open
        onClose={() => undefined}
        reviewProjectId="project"
        scope={{ projectId: 'project' }}
      />
    )
    fireEvent.click(await screen.findByRole('button', { name: /Financing review/ }))
    expect(await screen.findByTestId('pdf-reader')).not.toBeNull()
    expect(
      (screen.getByRole('button', { name: /Viewpoint extraction/ }) as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Defer unresolved and continue' }))
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'confirm', stage: 'screen', deferUnresolved: true })
      )
    )
  })
  it('previews PDFs inline and sends matched evidence to the page and search controls', async () => {
    const w = fixture()
    const mutate = vi.fn(async () => ({ workflow: w }))
    render(<ScreeningReview workflow={w} step={3} disabled={false} mutate={mutate} />)
    await screen.findByTestId('pdf-reader')
    fireEvent.click(screen.getByRole('button', { name: /Verified evidence/ }))
    expect(pdf.mock.calls.at(-1)?.[0]).toMatchObject({
      source: 'literature',
      revealRequest: { pageNumber: 3, query: 'Verified evidence' }
    })
    fireEvent.change(screen.getByLabelText('Review notes'), {
      target: { value: 'Checked the PDF' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Include' }))
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'review',
          decision: 'included',
          note: 'Checked the PDF',
          itemIds: ['paper']
        })
      )
    )
  })
  it('retains unsaved configuration after a failed save and remount', async () => {
    const w = fixture()
    const mutate = vi.fn(async () => undefined)
    const props = { workflow: w, disabled: false, mutate, onSaved: vi.fn() }
    const first = render(<ScreeningSetup {...props} />)
    fireEvent.change(screen.getByLabelText('Review topic'), { target: { value: 'Updated scope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and prepare full text' }))
    await waitFor(() => expect(mutate).toHaveBeenCalled())
    expect(props.onSaved).not.toHaveBeenCalled()
    first.unmount()
    render(<ScreeningSetup {...props} />)
    expect((screen.getByLabelText('Review topic') as HTMLTextAreaElement).value).toBe(
      'Updated scope'
    )
  })
  it('previews actual report content and downloads the same package, invalidating it when options change', async () => {
    const w = fixture()
    const exported = buildScreeningExport(w, true, ['paper'])
    const mutate = vi.fn(async () => ({ export: exported }))
    const save = vi.fn(async () => ({ saved: true }))
    window.api.saveBlobFile = save
    render(<ScreeningExport workflow={w} disabled={false} mutate={mutate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview evidence package' }))
    expect(await screen.findByRole('region', { name: 'Evidence package preview' })).not.toBeNull()
    expect(screen.getByTitle('Preview of screening_details.docx')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '工作流记录.json' }))
    expect(screen.getByText(/"schemaVersion": 1/)).not.toBeNull()
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ preview: true, partial: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Save evidence package as…' }))
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByLabelText('Allow partial export and list incomplete references'))
    fireEvent.click(screen.getByRole('button', { name: 'Save evidence package as…' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(mutate).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByLabelText('Export screening report only'))
    expect(screen.queryByRole('region', { name: 'Evidence package preview' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview evidence package' }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(3))
  })
  it('has no AI polishing entry', () => {
    render(
      <ScreeningSetup workflow={fixture()} disabled={false} mutate={vi.fn()} onSaved={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: 'AI polish settings' })).toBeNull()
  })
  it('preserves legacy criteria verbatim until they are edited', () => {
    const w = fixture()
    w.config.exclusion = 'E1: Reviews; commentaries.\nMissing full text is pending, not excluded.'
    const mutate = vi.fn()
    render(<ScreeningSetup workflow={w} disabled={false} mutate={mutate} onSaved={vi.fn()} />)
    expect((screen.getByLabelText('Exclusion criteria item 1') as HTMLTextAreaElement).value).toBe(
      w.config.exclusion
    )
    const group = within(screen.getByRole('group', { name: 'Exclusion criteria' }))
    expect((group.getByLabelText('Follow written rules') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save and prepare full text' }))
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ config: w.config }))
  })
  it('persists condition rows, matching logic and exceptions through drafts and server reloads', async () => {
    const w = fixture()
    const mutate = vi.fn(async () => undefined)
    const props = { workflow: w, disabled: false, mutate, onSaved: vi.fn() }
    const first = render(<ScreeningSetup {...props} />)
    const inclusion = within(screen.getByRole('group', { name: 'Inclusion criteria' }))
    fireEvent.click(inclusion.getByLabelText('All conditions'))
    fireEvent.change(screen.getByLabelText('Inclusion criteria item 1'), {
      target: { value: ' English journal articles; 2011–2022 ' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Inclusion criteria item' }))
    fireEvent.change(screen.getByLabelText('Inclusion criteria item 2'), {
      target: { value: 'Original empirical studies' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Inclusion criteria item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Inclusion criteria item' }))
    fireEvent.change(screen.getByLabelText('Inclusion criteria item 3'), {
      target: { value: 'Remove me' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Inclusion criteria item 3' }))
    const exclusion = within(screen.getByRole('group', { name: 'Exclusion criteria' }))
    fireEvent.click(exclusion.getByLabelText('Any condition'))
    fireEvent.change(screen.getByLabelText('Exclusion criteria notes and exceptions'), {
      target: { value: 'Missing full text stays pending.' }
    })
    first.unmount()
    const second = render(<ScreeningSetup {...props} />)
    expect((screen.getByLabelText('Inclusion criteria item 2') as HTMLTextAreaElement).value).toBe(
      'Original empirical studies'
    )
    expect(
      (screen.getByLabelText('Exclusion criteria notes and exceptions') as HTMLTextAreaElement)
        .value
    ).toBe('Missing full text stays pending.')
    fireEvent.click(screen.getByRole('button', { name: 'Save and prepare full text' }))
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            inclusionRules: {
              mode: 'all',
              items: ['English journal articles; 2011–2022', 'Original empirical studies'],
              notes: ''
            },
            exclusionRules: {
              mode: 'any',
              items: ['Households'],
              notes: 'Missing full text stays pending.'
            },
            inclusion: expect.stringContaining('Include only when every condition is met.'),
            exclusion: expect.stringContaining('Missing full text stays pending.')
          })
        })
      )
    )
    const saved = (mutate.mock.calls as unknown as [ScreeningRequest][])[0][0]
    if (saved.action !== 'config') throw new Error('Expected configuration save')
    second.unmount()
    localStorage.clear()
    render(<ScreeningSetup {...props} workflow={{ ...w, config: saved.config }} />)
    expect((screen.getByLabelText('Inclusion criteria item 2') as HTMLTextAreaElement).value).toBe(
      'Original empirical studies'
    )
    expect(screen.queryByLabelText('Inclusion criteria item 3')).toBeNull()
    expect(
      (
        within(screen.getByRole('group', { name: 'Exclusion criteria' })).getByLabelText(
          'Any condition'
        ) as HTMLInputElement
      ).checked
    ).toBe(true)
  })
  it('requires actual conditions and disables criteria controls during processing', () => {
    const w = fixture()
    w.config.inclusion = ''
    w.config.exclusion = ''
    const props = { workflow: w, mutate: vi.fn(), onSaved: vi.fn() }
    const view = render(<ScreeningSetup {...props} disabled={false} />)
    expect(
      (
        within(screen.getByRole('group', { name: 'Inclusion criteria' })).getByLabelText(
          'All conditions'
        ) as HTMLInputElement
      ).checked
    ).toBe(true)
    expect(
      (
        within(screen.getByRole('group', { name: 'Exclusion criteria' })).getByLabelText(
          'Any condition'
        ) as HTMLInputElement
      ).checked
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Inclusion criteria notes and exceptions'), {
      target: { value: 'A note alone is not a condition' }
    })
    expect(
      (screen.getByRole('button', { name: 'Save and prepare full text' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    view.rerender(<ScreeningSetup {...props} disabled />)
    expect(screen.getByLabelText('Inclusion criteria item 1').matches(':disabled')).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Add Inclusion criteria item' }).matches(':disabled')
    ).toBe(true)
    expect(
      screen.getByLabelText('Exclusion criteria notes and exceptions').matches(':disabled')
    ).toBe(true)
  })
  it('saves separate dimensions without splitting punctuation and restores all draft rows', async () => {
    const w = fixture()
    const mutate = vi.fn(async () => undefined)
    const props = { workflow: w, disabled: false, mutate, onSaved: vi.fn() }
    const first = render(<ScreeningSetup {...props} />)
    const concept = 'CSR, ESG；企业责任、可持续发展'
    fireEvent.change(screen.getByLabelText('Concepts item 1'), {
      target: { value: concept }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Concepts item' }))
    fireEvent.change(screen.getByLabelText('Concepts item 2'), {
      target: { value: '  Mandatory disclosure  ' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Concepts item' }))
    fireEvent.change(screen.getByLabelText('Concepts item 3'), {
      target: { value: concept }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Concepts item' }))
    fireEvent.change(screen.getByLabelText('Relationships item 1'), {
      target: { value: 'Disclosure → costs; mechanisms\nwith context' }
    })
    first.unmount()
    render(<ScreeningSetup {...props} />)
    expect((screen.getByLabelText('Concepts item 2') as HTMLTextAreaElement).value).toBe(
      '  Mandatory disclosure  '
    )
    expect((screen.getByLabelText('Concepts item 4') as HTMLTextAreaElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Viewpoints item 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save and prepare full text' }))
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'config',
          config: {
            ...w.config,
            concepts: [concept, 'Mandatory disclosure'],
            relations: ['Disclosure → costs; mechanisms\nwith context'],
            viewpoints: []
          }
        })
      )
    )
  })
  it('loads saved dimensions, removes a middle row and prevents oversized legacy drafts from saving', () => {
    const w = fixture()
    w.config.concepts = ['First', 'Middle', 'Last']
    const mutate = vi.fn()
    const props = { workflow: w, disabled: false, mutate, onSaved: vi.fn() }
    const first = render(<ScreeningSetup {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Concepts item 2' }))
    expect((screen.getByLabelText('Concepts item 2') as HTMLTextAreaElement).value).toBe('Last')
    fireEvent.click(screen.getByRole('button', { name: 'Save and prepare full text' }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ config: { ...w.config, concepts: ['First', 'Last'] } })
    )
    first.unmount()
    localStorage.setItem(
      `screening-config:${w.id}:${w.revision}`,
      JSON.stringify({ ...w.config, concepts: ['x'.repeat(301)] })
    )
    render(<ScreeningSetup {...props} />)
    expect(
      (screen.getByRole('button', { name: 'Save and prepare full text' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('length and number limits')
    // Preserve existing text so the user can edit it; do not silently truncate it.
    expect((screen.getByLabelText('Concepts item 1') as HTMLTextAreaElement).value).toHaveLength(
      301
    )
    fireEvent.change(screen.getByLabelText('Concepts item 1'), { target: { value: 'Valid' } })
    expect(
      (screen.getByRole('button', { name: 'Save and prepare full text' }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
  })
  it('enforces dimension count limits and disables every dimension control during processing', () => {
    const w = fixture()
    w.config.concepts = Array.from({ length: 50 }, (_, i) => `Concept ${i}`)
    const props = { workflow: w, mutate: vi.fn(), onSaved: vi.fn() }
    const view = render(<ScreeningSetup {...props} disabled={false} />)
    expect(
      (screen.getByRole('button', { name: 'Add Concepts item' }) as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Concepts item 25' }))
    expect(
      (screen.getByRole('button', { name: 'Add Concepts item' }) as HTMLButtonElement).disabled
    ).toBe(false)
    view.rerender(<ScreeningSetup {...props} disabled />)
    expect(screen.getByLabelText('Concepts item 1').matches(':disabled')).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Remove Concepts item 1' }).matches(':disabled')
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Add Concepts item' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
  it('revalidates downloads even when a partial preview is cached', async () => {
    const w = fixture()
    const exported = buildScreeningExport(w, true, ['paper'])
    const mutate = vi
      .fn()
      .mockResolvedValueOnce({ export: exported })
      .mockResolvedValueOnce(undefined)
    const save = vi.fn()
    window.api.saveBlobFile = save
    render(<ScreeningExport workflow={w} disabled={false} mutate={mutate} />)
    fireEvent.click(screen.getByLabelText('Allow partial export and list incomplete references'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview evidence package' }))
    await screen.findByRole('region', { name: 'Evidence package preview' })
    fireEvent.click(screen.getByRole('button', { name: 'Save evidence package as…' }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2))
    expect(mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ preview: false, partial: true })
    )
    expect(save).not.toHaveBeenCalled()
  })
})
