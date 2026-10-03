// Modified by EconoMind contributors: settings and offline attribution regression coverage.
import { expect } from '@playwright/test'
import { test } from './fixtures/electron-app'

test('opens every settings panel and reads the bundled upstream attribution offline', async ({
  app
}, testInfo) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await page
    .locator('.research-workbench-header')
    .getByRole('button', { name: /settings/i })
    .click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  const navigation = settings.getByRole('navigation', { name: 'Settings', exact: true })
  for (const panel of [
    'General',
    'Model',
    'Agent',
    'Skills',
    'Specialists',
    'Memory',
    'Connectors',
    'Network',
    'Credentials',
    'Tags',
    'Permissions',
    'Runtimes',
    'Storage',
    'Compute',
    'Usage',
    'Archived'
  ]) {
    await navigation.getByRole('button', { name: panel, exact: true }).click()
    await expect(settings.getByRole('heading', { name: panel, exact: true }).first()).toBeVisible()
    await expect(
      settings.getByRole('alert').filter({ hasText: /failed|exception|unexpected error/i })
    ).toHaveCount(0)
    await expect(
      settings.locator('a[href*="aipoch.com"], a[href*="discord"], a[href*="x.com"]')
    ).toHaveCount(0)
  }
  await navigation.getByRole('button', { name: 'General', exact: true }).click()
  await expect(
    settings.getByText(
      'EconoMind is an independent derivative of AIPOCH Open Science, licensed under Apache-2.0.',
      { exact: true }
    )
  ).toBeVisible()
  await expect(settings.getByRole('button', { name: 'Check now', exact: true })).toBeDisabled()

  // No website is required to read the actual shipped legal documents.
  await page.context().setOffline(true)
  await settings.getByRole('button', { name: 'Open-source license', exact: true }).click()
  const notices = page.getByRole('dialog', { name: 'Open-source license', exact: true })
  await expect(notices).toBeVisible()
  await expect(notices.getByRole('region', { name: 'NOTICE', exact: true })).toContainText(
    'Copyright 2026 AIPOCH'
  )
  await expect(notices.getByRole('region', { name: 'NOTICE', exact: true })).toContainText(
    'Modifications Copyright 2026 EconoMind contributors'
  )
  await expect(
    notices.getByRole('region', { name: 'LICENSE (Apache-2.0)', exact: true })
  ).toContainText('TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION')
  await page.screenshot({ path: testInfo.outputPath('offline-open-source-notices.png') })
  await notices.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(settings).toBeVisible()
  await page.context().setOffline(false)
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'zh-Hans' }))
  await page.screenshot({ path: testInfo.outputPath('general-brand-attribution-zh.png') })
})
