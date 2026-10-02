import { expect } from '@playwright/test'
import { test } from './fixtures/electron-app'

test.use({ windowMode: 'normal' })

test('keeps one global navigation and opens the literature library', async ({ app }) => {
  const page = await app.completeOnboarding()
  const navigation = page.getByRole('navigation', { name: 'Workbench modules' })
  await expect(navigation.getByRole('button')).toHaveText([
    'Research home',
    'Library',
    'Research workspace'
  ])
  await expect(page.getByRole('heading', { name: 'Research workbench', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Workbench modules' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeVisible()
  await navigation.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Literature research', exact: true })
  ).toBeVisible()
})
