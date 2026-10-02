import { expect } from '@playwright/test'
import { test } from './fixtures/electron-app'

test('uses economics resources and application branding without remote access', async ({
  app
}, testInfo) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  const project = page.getByRole('dialog', { name: 'New project' })
  await project.getByLabel('Name', { exact: true }).fill('EconoMind verification')
  await project.getByRole('button', { name: 'Create project', exact: true }).click()
  const banner = page.getByTestId('empty-conversation-banner')
  await expect(banner.locator('img')).toBeVisible()
  await expect(banner.locator('img')).toHaveAttribute('src', /logo.*\.png/)
  await expect(banner.locator('.lucide-book-open-text')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('workbench-logo.png') })

  await page
    .locator('.research-workbench-header')
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
  const navigation = page.getByRole('navigation', { name: 'Settings' })
  await expect(navigation.getByRole('button', { name: 'Remote', exact: true })).toHaveCount(0)
  const remoteResult = await page.evaluate(async () => {
    try {
      await window.api.remoteAccess.setMode({ mode: 'remoteit' })
      return 'unexpectedly enabled'
    } catch (error) {
      return String(error)
    }
  })
  expect(remoteResult).toMatch(/No handler registered|not bound|unavailable/i)

  await navigation.getByRole('button', { name: 'General', exact: true }).click()
  await expect(page.getByRole('radiogroup', { name: 'Theme', exact: true })).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'App icon', exact: true })).toHaveCount(0)

  await navigation.getByRole('button', { name: 'Network', exact: true }).click()
  await page.getByRole('button', { name: 'Configure domains', exact: true }).click()
  await expect(
    page.getByText('Macroeconomics and official statistics', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText('Financial markets and monetary policy', { exact: true })
  ).toBeVisible()
  await expect(page.getByText('Corporate finance and disclosures', { exact: true })).toBeVisible()
  await expect(page.getByText('Economics and management literature', { exact: true })).toBeVisible()
  await expect(page.getByText('NIH and NCBI', { exact: true })).toHaveCount(0)
  const macro = page.getByRole('switch', {
    name: 'Allow Macroeconomics and official statistics',
    exact: true
  })
  await macro.click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(macro).not.toBeChecked()
  const snapshot = await page.evaluate(() => window.api.settings.getSettings())
  expect(snapshot.notebookNetwork?.disabledOpenScienceDomainGroups).toContain('macroeconomics')
  await macro.click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(macro).toBeChecked()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'zh-Hans' }))
  await expect(page.getByText('宏观经济与官方统计', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('economics-network-zh-Hans.png') })
})
