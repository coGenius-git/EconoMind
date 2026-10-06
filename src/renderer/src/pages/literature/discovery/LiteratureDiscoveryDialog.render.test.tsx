// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { discoveryCandidateSchema } from '../../../../../shared/literature-discovery'
import { LiteratureDiscoveryDialog } from './LiteratureDiscoveryDialog'

vi.mock('../detail/LiteratureOpenAlexCredential', () => ({
  LiteratureOpenAlexCredential: () => null
}))

const search = vi.fn()
const importRecords = vi.fn()
const close = vi.fn()
const imported = vi.fn()
const candidate = discoveryCandidateSchema.parse({
  key: 'openalex:W1',
  source: 'openalex',
  title: 'AI and firm performance'
})

beforeEach(() => {
  vi.clearAllMocks()
  search.mockResolvedValue({ candidates: [candidate], statuses: [], warnings: [] })
  importRecords.mockResolvedValue({
    imported: [{ key: candidate.key, itemId: 'item-1' }],
    skipped: [],
    importedCount: 1
  })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { literature: { discoverySearch: search, discoveryImport: importRecords } }
  })
})
afterEach(cleanup)

it('offers only OpenAlex filters and sends language and sorting to its search', async () => {
  render(<LiteratureDiscoveryDialog onClose={close} onImported={imported} />)
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.queryByLabelText('CNKI')).toBeNull()
  expect(dialog.queryByLabelText('CSSCI')).toBeNull()
  expect(dialog.queryByLabelText('SCI')).toBeNull()
  expect(dialog.queryByLabelText('Import a CNKI export file')).toBeNull()
  fireEvent.change(dialog.getByLabelText('Search terms'), {
    target: { value: 'artificial intelligence AND firm performance' }
  })
  fireEvent.change(dialog.getByLabelText('Language'), { target: { value: 'en' } })
  fireEvent.change(dialog.getByLabelText('Sort by'), { target: { value: 'citations' } })
  fireEvent.click(dialog.getByLabelText('Preprint'))
  fireEvent.click(dialog.getByLabelText('Open access only'))
  fireEvent.click(dialog.getByRole('button', { name: 'Search' }))
  await waitFor(() =>
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: ['openalex'],
        language: 'en',
        sort: 'citations',
        documentTypes: ['preprint'],
        sourceTiers: ['open-access']
      })
    )
  )
})

it('rejects inverted publication years before calling the provider', async () => {
  render(<LiteratureDiscoveryDialog onClose={close} />)
  fireEvent.change(screen.getByLabelText('Search terms'), { target: { value: 'AI' } })
  fireEvent.change(screen.getByLabelText('Publication year from'), { target: { value: '2025' } })
  fireEvent.change(screen.getByLabelText('Publication year to'), { target: { value: '2020' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    expect.stringContaining('Publication year from must not exceed publication year to.')
  )
  expect(search).not.toHaveBeenCalled()
})
