import { expect } from '@playwright/test'
import { test } from './fixtures/electron-app'

test('keeps the full library and economics tools reachable after the upstream upgrade', async ({
  app
}, testInfo) => {
  let page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  const project = await page.evaluate(() =>
    window.api.projects.create({ name: 'Economics upgrade', category: 'economics' })
  )
  page = await app.restart()
  await page
    .getByRole('region', { name: 'Projects', exact: true })
    .getByRole('button', { name: /^Economics upgrade/ })
    .click()
  await page
    .getByRole('navigation', { name: 'Workbench modules' })
    .getByRole('button', { name: 'Library', exact: true })
    .click()
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Literature screening', exact: true })
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Literature screening', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Screening stages' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New screening task', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to library', exact: true }).click()
  await page.getByRole('button', { name: 'Bibliometrics', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Bibliometrics')
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'zh-Hans' }))
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans')
  await page.screenshot({ path: testInfo.outputPath('economind-full-library-zh.png') })
  expect(
    await page.evaluate(
      async (id) => (await window.api.projects.list()).find((p) => p.id === id)?.category,
      project.id
    )
  ).toBe('economics')
})
