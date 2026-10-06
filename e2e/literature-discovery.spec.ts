import { expect, type ElectronApplication } from '@playwright/test'
import { test } from './fixtures/electron-app'

const exportText = [
  'RT Journal Article',
  'T1 Original discovery paper',
  'A1 Ada Lovelace',
  'YR 2023',
  'DO 10.1234/discovery-one',
  '',
  'RT Journal Article',
  'T1 Duplicate discovery paper',
  'A1 Ada Lovelace',
  'YR 2023',
  'DO 10.1234/discovery-one',
  '',
  'RT Journal Article',
  'T1 Final discovery paper',
  'A1 Grace Hopper',
  'YR 2024',
  'DO 10.1234/discovery-two',
  ''
].join('\n')

test('imports OpenAlex search results and keeps duplicate mappings correct', async ({ app }) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  // Stub only the external search in this isolated app; imports, duplicate mapping and storage
  // still use the real command bridge. Provider filter encoding has its own regression test.
  const candidates = await page.evaluate(async (content) => {
    const parsed = await window.api.literature.discoveryParseRecords({ content })
    return parsed.candidates.map((candidate, index) => ({
      ...candidate,
      source: 'openalex' as const,
      key: `openalex:fixture-${index}`
    }))
  }, exportText)
  const application = (app as unknown as { application: ElectronApplication }).application
  await application.evaluate(({ ipcMain }, records) => {
    ipcMain.removeHandler('literature:discovery-search')
    ipcMain.handle('literature:discovery-search', (_event, query) => {
      if (
        query.sources.length !== 1 ||
        query.sources[0] !== 'openalex' ||
        query.language !== 'en' ||
        query.sort !== 'citations'
      )
        throw new Error('OpenAlex filter fixture mismatch')
      return { candidates: records, statuses: [], warnings: [] }
    })
  }, candidates)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('button', { name: 'Search external sources', exact: true }).click()
  const discovery = page.getByRole('dialog', { name: 'Search OpenAlex', exact: true })
  await expect(discovery.getByRole('checkbox', { name: 'CNKI', exact: true })).toHaveCount(0)
  await expect(discovery.getByRole('checkbox', { name: 'SCI', exact: true })).toHaveCount(0)
  await discovery.getByLabel('Search terms', { exact: true }).fill('firm performance')
  await discovery.getByLabel('Language', { exact: true }).selectOption('en')
  await discovery.getByLabel('Sort by', { exact: true }).selectOption('citations')
  await discovery.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    discovery.getByRole('checkbox', { name: 'Final discovery paper', exact: true })
  ).toBeVisible()
  await discovery.getByRole('button', { name: 'Select all', exact: true }).click()
  await discovery.getByRole('button', { name: 'Import selected', exact: true }).click()
  await expect(discovery.getByText('Imported records: 2', { exact: true })).toBeVisible()
  // Reuse the persisted records through the real command bridge. Each candidate must retain its
  // actual target even though the library returned only two unique IDs for three input records.
  const imported = await page.evaluate(async (records) => {
    const receipt = await window.api.literature.discoveryImport({
      candidates: records,
      collectionId: null,
      duplicatePolicy: 'reuse'
    })
    return Promise.all(
      receipt.imported.map(async (entry) => ({
        ...entry,
        title: (await window.api.literature.get(entry.itemId))?.item.title
      }))
    )
  }, candidates)
  expect(imported).toHaveLength(3)
  expect(imported[0].itemId).toBe(imported[1].itemId)
  expect(imported[2].itemId).not.toBe(imported[0].itemId)
  expect(imported[2].title).toBe('Final discovery paper')
  await discovery.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'All references', exact: true }).click()
  await expect(page.getByText('Final discovery paper', { exact: true })).toBeVisible()
})
