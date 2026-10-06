import { expect } from '@playwright/test'
import { createProject } from './certification/helpers'
import { test } from './fixtures/electron-app'

test('browses and summons Specialists from the sidebar without sending or losing an edited draft', async ({
  app
}, testInfo) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  const projectId = await createProject(page, 'Specialist browser regression')
  await page.setViewportSize({ width: 1440, height: 960 })
  const openCatalog = page.getByTestId('workspace-specialists-trigger')
  const browser = page.getByTestId('specialist-browser')
  const detail = page.getByTestId('specialist-browser-detail')
  const composer = page.getByRole('textbox', { name: 'Ask anything', exact: true })

  await openCatalog.click()
  await expect(browser).toBeVisible()
  await expect(openCatalog).toHaveAttribute('aria-pressed', 'true')
  await expect(browser.locator('[data-testid^="specialist-card-"]')).toHaveCount(5)
  await page.getByTestId('specialist-card-literature-review-agent').click()
  await expect(detail).toContainText('文献综述专家')
  await page.getByTestId('specialist-summon').click()
  await expect(browser).toBeHidden()
  await expect(composer).toContainText('Write a literature review on')
  await expect(page.getByTestId('composer-specialist-picker-trigger')).toHaveAttribute(
    'aria-label',
    'Choose Specialist: 文献综述专家'
  )
  expect((await page.evaluate(() => window.api.sessions.loadAll())).sessions).toHaveLength(0)

  await composer.fill('My edited catalog research question')
  await openCatalog.click()
  await page.getByTestId('specialist-card-data-agent').click()
  await page.getByTestId('specialist-summon').click()
  await expect(composer).toHaveText('My edited catalog research question')
  await expect(page.getByTestId('composer-specialist-picker-trigger')).toHaveAttribute(
    'aria-label',
    'Choose Specialist: 经管数据专家'
  )
  expect((await page.evaluate(() => window.api.sessions.loadAll())).sessions).toHaveLength(0)
  expect((await page.evaluate(() => window.api.projects.list())).map((item) => item.id)).toContain(
    projectId
  )

  await openCatalog.click()
  const search = browser.getByRole('searchbox', { name: 'Search specialists', exact: true })
  await search.fill('Methodology')
  await expect(browser.locator('[data-testid^="specialist-card-"]')).toHaveCount(1)
  await expect(page.getByTestId('specialist-card-methodology-agent')).toBeVisible()
  await search.fill('does-not-exist')
  await expect(browser).toContainText('No Specialists match your search.')
  await search.fill('')
  await browser.getByRole('button', { name: 'Custom', exact: true }).click()
  await expect(browser).toContainText('No Specialists in this category.')
  await browser.getByRole('button', { name: 'All', exact: true }).click()
  await browser.getByRole('button', { name: 'Manage Specialists', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Specialists')
  await page.keyboard.press('Escape')
  await expect(browser).toBeVisible()
  await browser.getByRole('button', { name: 'Back to conversation', exact: true }).click()
  await expect(composer).toHaveText('My edited catalog research question')

  // Visiting the catalog must restore the current preview state, including a state that changed
  // after WorkspacePanelLayout first mounted with an empty, collapsed preview.
  await page.getByRole('button', { name: 'Files', exact: true }).click()
  const previewToggle = page.getByTestId('workspace-preview-toggle')
  await expect(previewToggle).toHaveAttribute('aria-expanded', 'true')
  await openCatalog.click()
  await expect(previewToggle).toBeHidden()
  await browser.getByRole('button', { name: 'Back to conversation', exact: true }).click()
  await expect(previewToggle).toHaveAttribute('aria-expanded', 'true')
  await previewToggle.click()
  await expect(previewToggle).toHaveAttribute('aria-expanded', 'false')
  await openCatalog.click()
  await browser.getByRole('button', { name: 'Back to conversation', exact: true }).click()
  await expect(previewToggle).toHaveAttribute('aria-expanded', 'false')

  await openCatalog.click()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'zh-Hans' }))
  await page.getByTestId('specialist-card-literature-review-agent').click()
  await expect(browser.getByRole('heading', { name: '专家', exact: true })).toBeVisible()
  const lastCardFits = await page
    .getByTestId('specialist-card-review-agent')
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const directory = element.closest('.specialist-browser-directory')!.getBoundingClientRect()
      return bounds.bottom <= directory.bottom + 1
    })
  expect(lastCardFits).toBe(true)
  const summonFits = await page.getByTestId('specialist-summon').evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.top >= 0 && bounds.bottom <= window.innerHeight
  })
  expect(summonFits).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('specialist-browser-implemented.png') })

  // The same entry is reachable from mobile navigation, which dismisses after selection.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '打开导航', exact: true }).click()
  await page.getByTestId('workspace-specialists-trigger').click()
  await expect(browser).toBeVisible()
  await expect(page.getByRole('dialog', { name: '工作区导航' })).toBeHidden()
})
