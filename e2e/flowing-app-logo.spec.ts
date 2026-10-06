import { expect } from '@playwright/test'
import { createProject } from './certification/helpers'
import { test } from './fixtures/electron-app'

test('keeps the selected logo motion visible when the system requests reduced motion', async ({
  app
}) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await createProject(page, 'Logo motion preference')

  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true
  )
  const logo = page.getByTestId('empty-conversation-banner')
  await expect(logo.locator('.research-logo-flow')).toBeVisible()
  const light = logo.locator('.research-logo-orbit')
  expect(await light.evaluate((element) => getComputedStyle(element).animationDuration)).toBe('10s')
  const started = await light.evaluate((element) => Number(element.getAnimations()[0].currentTime))
  await expect
    .poll(() => light.evaluate((element) => Number(element.getAnimations()[0].currentTime)))
    .toBeGreaterThan(started + 100)
})
