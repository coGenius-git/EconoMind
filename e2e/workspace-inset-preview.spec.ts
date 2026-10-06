import { expect, type Locator, type Page } from '@playwright/test'
import { createProject } from './certification/helpers'
import { test } from './fixtures/electron-app'

const expectContainedPreview = async (page: Page, content: Locator): Promise<void> => {
  await expect(content).toBeVisible()
  await expect
    .poll(async () => {
      const sheet = await page.locator('.research-workbench-sheet').boundingBox()
      const panel = await page.locator('#right-panel').boundingBox()
      const header = await page.getByTestId('conversation-header').boundingBox()
      if (!sheet || !panel || !header) return false
      return (
        panel.x > sheet.x &&
        panel.y > header.y + header.height &&
        panel.x + panel.width < sheet.x + sheet.width &&
        panel.y + panel.height < sheet.y + sheet.height
      )
    })
    .toBe(true)
}

test('keeps file and compute previews inside the whole conversation sheet below its header', async ({
  app
}) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await createProject(page, 'Contained preview layout')
  const composer = page.getByRole('textbox', { name: 'Ask anything' })
  const draft = 'Keep this draft while inspecting files and compute.'
  await composer.fill(draft)

  await page.getByRole('button', { name: 'Files', exact: true }).click()
  const files = page.getByTestId('files-view')
  await expectContainedPreview(page, files)
  expect(
    await page
      .locator('#right-panel-resizable')
      .evaluate((element) => Number((element as HTMLElement).style.flexGrow))
  ).toBeCloseTo(30)

  // Glass belongs to a visual sibling so full-screen files still use the viewport.
  const panelBounds = await page.locator('#right-panel').boundingBox()
  await files.getByRole('button', { name: 'Expand files', exact: true }).click()
  const dialog = page.getByRole('dialog').filter({ has: files })
  await expect(dialog).toBeVisible()
  expect((await dialog.boundingBox())!.width).toBeGreaterThan(panelBounds!.width * 1.5)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expectContainedPreview(page, files)

  await page.getByRole('button', { name: 'Compute', exact: true }).click()
  await expectContainedPreview(page, page.locator('[aria-labelledby="project-compute-title"]'))
  await page.getByTestId('workspace-preview-toggle').click()
  await expect(page.getByTestId('workspace-preview-toggle')).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  await expect(composer).toHaveText(draft)
  await page.getByTestId('workspace-preview-toggle').click()
  await expectContainedPreview(page, page.locator('[aria-labelledby="project-compute-title"]'))
  await expect(composer).toHaveText(draft)
})
