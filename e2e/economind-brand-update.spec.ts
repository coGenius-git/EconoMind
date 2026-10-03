import { expect } from '@playwright/test'
import { test } from './fixtures/electron-app'

test('shows the approved brand on a clean conversation and explains unavailable development updates', async ({
  app
}, testInfo) => {
  let page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await page.evaluate(() =>
    window.api.projects.create({ name: 'Brand verification', category: 'economics' })
  )
  page = await app.restart()
  await page
    .getByRole('region', { name: 'Projects', exact: true })
    .getByRole('button', { name: /^Brand verification/ })
    .click()
  const banner = page.getByTestId('empty-conversation-banner')
  const logo = banner.locator('img')
  await expect(logo).toBeVisible()
  expect(
    await logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
  ).toBe(true)
  await expect(banner.getByRole('button', { name: 'Analyze data', exact: true })).toHaveCount(0)
  await expect(banner.getByRole('button', { name: 'Compare papers', exact: true })).toHaveCount(0)
  const logoSource = await logo.getAttribute('src')
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'zh-Hans' }))
  await page.screenshot({ path: testInfo.outputPath('conversation-logo.png') })
  await page
    .locator('.research-workbench-header')
    .getByRole('button', { name: '设置', exact: true })
    .click()
  await page
    .getByRole('navigation', { name: '设置', exact: true })
    .getByRole('button', { name: '通用', exact: true })
    .click()
  await expect(page.getByRole('button', { name: '立即检查', exact: true })).toBeDisabled()
  await expect(
    page.getByText('当前为开发版，不支持应用内更新。请使用 Git 更新源码。', { exact: true })
  ).toBeVisible()
  await expect(page.locator('[data-settings-anchor="general.about"] img')).toHaveAttribute(
    'src',
    logoSource!
  )
  expect(await page.evaluate(() => window.api.update.check())).toMatchObject({
    state: 'idle',
    unavailableReason: 'development-build'
  })
  await page.screenshot({ path: testInfo.outputPath('update-availability.png') })
})
