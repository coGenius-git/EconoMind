import { expect } from '@playwright/test'
import { createProject } from './certification/helpers'
import { test } from './fixtures/electron-app'

test('starts after setup, walks the real entry points, persists completion, and replays from native Settings', async ({
  app
}, testInfo) => {
  let page = app.page
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'zh-Hans' }))
  await expect(page.getByTestId('product-tour')).toBeHidden()
  // Complete setup through the same persisted command used by the wizard. Deliberately bypass
  // the ordinary completeOnboarding fixture, which seeds an already-seen tour for other journeys.
  await page.evaluate(() => window.api.settings.markOnboardingComplete())
  await page.reload({ waitUntil: 'domcontentloaded' })
  const settingsBefore = await page.evaluate(() => window.api.settings.getSettings())
  const guide = page.getByTestId('product-tour')
  await expect(guide).toBeVisible()
  await expect(guide.getByRole('heading', { name: '你的研究首页' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('tour-desktop.png') })
  const targets = [
    'home',
    'new-project',
    'projects',
    'recent-sessions',
    'library',
    'workspace',
    'search',
    'settings'
  ]
  for (let index = 0; index < targets.length; index++) {
    await expect(page.getByTestId('product-tour-highlight')).toHaveAttribute(
      'data-tour-target',
      targets[index]
    )
    await expect(guide).toContainText(`第 ${index + 1} 步，共 8 步`)
    const target = page.locator(`[data-product-tour="${targets[index]}"]`)
    const highlighted = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const highlight = document
        .querySelector('[data-testid="product-tour-highlight"]')!
        .getBoundingClientRect()
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        Math.abs(rect.left - highlight.left) <= 8 &&
        Math.abs(rect.top - highlight.top) <= 8
      )
    })
    expect(highlighted).toBe(true)
    if (index === 1) {
      await guide.getByRole('button', { name: '上一步' }).click()
      await expect(guide.getByRole('heading', { name: '你的研究首页' })).toBeVisible()
      await guide.getByRole('button', { name: '下一步' }).click()
    }
    if (index < targets.length - 1) await guide.getByRole('button', { name: '下一步' }).click()
  }
  await guide.getByRole('button', { name: '完成引导' }).click()
  await expect(guide).toBeHidden()
  // Startup detection independently discovers the installed Claude runtime and advances the
  // snapshot revision. Check every user preference while allowing that discovery metadata.
  const settingsAfter = await page.evaluate(() => window.api.settings.getSettings())
  expect(settingsAfter).toEqual({
    ...settingsBefore,
    revision: settingsAfter.revision,
    claude: settingsAfter.claude
  })
  expect(await page.evaluate(() => window.api.projects.list())).toHaveLength(0)
  page = await app.restart()
  await expect(page.getByRole('button', { name: '新建项目', exact: true })).toBeVisible()
  await expect(page.getByTestId('product-tour')).toBeHidden()

  const settingsOpened = page.context().waitForEvent('page')
  await page.locator('[data-product-tour="settings"]').click()
  const settingsPage = await settingsOpened
  await expect(settingsPage).toHaveURL(/window=settings/)
  await settingsPage.getByRole('button', { name: '通用', exact: true }).click()
  await settingsPage.getByRole('button', { name: '重新进行新手引导', exact: true }).click()
  await expect.poll(() => settingsPage.isClosed()).toBe(true)
  await expect(
    page.getByTestId('product-tour').getByRole('heading', { name: '你的研究首页' })
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  for (let index = 0; index < targets.length; index++) {
    const mobileGuide = page.getByTestId('product-tour')
    await expect(mobileGuide).toBeVisible()
    const bounds = await mobileGuide.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845)
    await expect(page.getByTestId('product-tour-highlight')).toHaveAttribute(
      'data-tour-target',
      targets[index]
    )
    if (index === 5) await page.screenshot({ path: testInfo.outputPath('tour-mobile.png') })
    if (index < targets.length - 1)
      await mobileGuide.getByRole('button', { name: '下一步' }).click()
  }
  await page.getByTestId('product-tour').getByRole('button', { name: '跳过引导' }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: '新建项目', exact: true })).toBeVisible()
  await expect(page.getByTestId('product-tour')).toBeHidden()
})

test('replays from an existing workspace without losing an unsent conversation draft', async ({
  app
}) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await createProject(page, 'Guide draft preservation')
  const composer = page.getByRole('textbox', { name: 'Ask anything', exact: true })
  await composer.fill('My unsent research question')
  const settingsOpened = page.context().waitForEvent('page')
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  const settingsPage = await settingsOpened
  await settingsPage.getByRole('button', { name: 'General', exact: true }).click()
  await settingsPage.getByRole('button', { name: 'Restart new user guide', exact: true }).click()
  await expect.poll(() => settingsPage.isClosed()).toBe(true)
  const guide = page.getByTestId('product-tour')
  await expect(guide.getByRole('heading', { name: 'Your research home' })).toBeVisible()
  await guide.getByRole('button', { name: 'Skip guide' }).click()
  await page
    .getByRole('region', { name: 'Projects', exact: true })
    .getByRole('button', { name: 'Guide draft preservation', exact: true })
    .click()
  await expect(composer).toHaveText('My unsent research question')
  expect(await page.evaluate(() => window.api.projects.list())).toHaveLength(1)
})
