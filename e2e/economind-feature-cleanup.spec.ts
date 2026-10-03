import { expect } from '@playwright/test'
import { test } from './fixtures/electron-app'

test('keeps local skills and specialists while removing remote, marketplaces and social links', async ({
  app
}, testInfo) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'zh-Hans' }))
  await page
    .locator('.research-workbench-header')
    .getByRole('button', { name: '模型设置', exact: true })
    .click()
  const navigation = page.getByRole('navigation', { name: '设置' })
  await expect(navigation.getByRole('button', { name: '远程', exact: true })).toHaveCount(0)
  await navigation.getByRole('button', { name: '通用', exact: true }).click()
  await expect(page.getByRole('radiogroup', { name: '应用图标' })).toHaveCount(0)
  await expect(
    page.locator('a[href*="discord"], a[href*="x.com"], a[href*="genius666"]')
  ).toHaveCount(0)
  expect(
    await page.evaluate(() => ({
      remote: 'remoteAccess' in window.api,
      skillsMarketplace: 'listSkillMarketplace' in window.api.settings,
      specialistsMarketplace: 'listMarketplace' in window.api.specialist,
      createSkill: typeof window.api.settings.createSkill,
      createSpecialist: typeof window.api.specialist.create
    }))
  ).toEqual({
    remote: false,
    skillsMarketplace: false,
    specialistsMarketplace: false,
    createSkill: 'function',
    createSpecialist: 'function'
  })
  await page.screenshot({ path: testInfo.outputPath('general-cleanup.png') })
  await navigation.getByRole('button', { name: '技能', exact: true }).click()
  await expect(page.getByText('浏览市场', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '添加技能', exact: true })).toBeVisible()
  await navigation.getByRole('button', { name: '专家', exact: true }).click()
  await expect(page.getByText('浏览市场', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '添加专家', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('specialists-cleanup.png') })
  await navigation.getByRole('button', { name: '连接器', exact: true }).click()
  await expect(page.getByText('Zenodo', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('PubMed', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Chemistry', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('connectors-cleanup.png') })
})
