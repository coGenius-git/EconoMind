import { expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from './fixtures/electron-app'
import { createProject } from './certification/helpers'
import { literatureItemInputSchema } from '../src/shared/literature'

test('Settings workflow buttons open a draft in the main renderer', async ({ app }) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await createProject(page, 'Settings workflow routing')
  for (const panel of ['Skills', 'Specialists'] as const) {
    const opened = page.context().waitForEvent('page')
    await page.evaluate(() => window.api.window.openSettings!())
    const settingsPage = await opened
    const settings = settingsPage.getByRole('dialog', { name: 'Settings', exact: true })
    await settings
      .getByRole('navigation', { name: 'Settings', exact: true })
      .getByRole('button', { name: panel, exact: true })
      .click()
    await settings
      .getByRole('button', {
        name: panel === 'Skills' ? 'Add skill' : 'Add specialist',
        exact: true
      })
      .click()
    await settingsPage.getByRole('menuitem', { name: /Chat with agent/ }).click()
    await expect.poll(() => settingsPage.isClosed()).toBe(true)
    await expect(page.getByRole('textbox', { name: 'Ask anything', exact: true })).toContainText(
      /\/customize/i
    )
    expect(
      await page.evaluate(async () => (await window.api.sessions.list()).sessions)
    ).toHaveLength(0)
  }
})

test('workspace preview minimization restores main-window search shortcuts', async ({ app }) => {
  await app.completeOnboarding()
  const page = await app.configureFakeAgent()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await createProject(page, 'Preview shortcut ownership')
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'shortcut-check.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Retain this preview while searching')
  })
  await page
    .getByRole('textbox', { name: 'Ask anything', exact: true })
    .fill('Read my attached note')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(page.getByText('Deterministic reply:', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Files', exact: true }).click()
  await page
    .getByRole('button', { name: 'Preview uploaded file shortcut-check.txt', exact: true })
    .click()
  const preview = page.locator('[data-slot="file-preview-dialog"]')
  await expect(preview).toBeVisible()
  await preview.getByRole('button', { name: 'Hide preview', exact: true }).click()
  await expect(preview).toBeHidden()
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Global search', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Restore preview of/ }).click()
  await expect(preview).toBeVisible()
})

test('opens frosted Settings in place, keeps edits, and restores the main view on close', async ({
  app
}, testInfo) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  const windowCount = page.context().pages().length
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(settings).toBeVisible()
  expect(page.context().pages()).toHaveLength(windowCount)
  const backdrop = page.locator('.research-settings-backdrop')
  await expect(backdrop).toBeVisible()
  expect(await backdrop.evaluate((element) => getComputedStyle(element).backdropFilter)).toContain(
    'blur('
  )
  await settings
    .getByRole('navigation', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'General', exact: true })
    .click()
  const toggle = settings.getByRole('switch', { name: 'Toggle task notifications', exact: true })
  const wasEnabled = (await toggle.getAttribute('aria-checked')) === 'true'
  await toggle.click()
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.api.settings.getSettings())).notificationsEnabled
    )
    .toBe(!wasEnabled)
  await page.screenshot({ path: testInfo.outputPath('frosted-settings-overlay.png') })
  await settings.getByRole('button', { name: 'Close settings', exact: true }).click()
  await expect(settings).toBeHidden()
  await expect(backdrop).toBeHidden()
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Literature library', exact: true })).toBeVisible()
})

test('opens one independent Settings window while the main Library remains interactive', async ({
  app
}, testInfo) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await expect(page.getByText('Getting started with EconoMind', { exact: true })).toHaveCount(0)
  const nextWindow = page.context().waitForEvent('page')
  await page.evaluate(() => window.api.window.openSettings!())
  const settingsPage = await nextWindow
  await expect(settingsPage).toHaveURL(/window=settings/)
  const settings = settingsPage.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(settings).toBeVisible()
  await expect(settings.getByRole('button', { name: 'Close settings', exact: true })).toHaveCount(0)
  await expect(settings.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
  await expect(settings.getByRole('button', { name: 'Forward', exact: true })).toHaveCount(0)
  await expect(settings.locator('[data-slot="settings-global-search"]')).toHaveCount(0)
  await settingsPage.keyboard.press('Control+k')
  await expect(settings.locator('[aria-label="Search settings"]')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Literature library', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'All references', exact: true }).click()
  await expect(settings).toBeVisible()
  expect(await page.locator('#root').evaluate((element) => (element as HTMLElement).inert)).toBe(
    false
  )
  await page.evaluate(() => window.api.window.openSettings!())
  expect(
    page
      .context()
      .pages()
      .filter((candidate) => candidate.url().includes('window=settings'))
  ).toHaveLength(1)
  await settings
    .getByRole('navigation', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'General', exact: true })
    .click()
  const toggle = settings.getByRole('switch', { name: 'Toggle task notifications', exact: true })
  const wasEnabled = (await toggle.getAttribute('aria-checked')) === 'true'
  await toggle.click()
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.api.settings.getSettings())).notificationsEnabled
    )
    .toBe(!wasEnabled)
  await settingsPage.screenshot({ path: testInfo.outputPath('independent-settings.png') })
  await page.screenshot({ path: testInfo.outputPath('library-with-settings-open.png') })
  await settings
    .getByRole('navigation', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'Model', exact: true })
    .click()
  await settings.locator('[data-settings-anchor="model.add-provider"]').click()
  await settings
    .getByRole('textbox', { name: 'Provider name', exact: true })
    .fill('Unsaved window draft')
  // This IPC uses the same BrowserWindow.close path as the native titlebar close control.
  await settingsPage.evaluate(() => window.api.window.close())
  const discard = settingsPage.getByRole('alertdialog', { name: 'Discard unsaved changes?' })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(settings.getByRole('textbox', { name: 'Provider name', exact: true })).toHaveValue(
    'Unsaved window draft'
  )
  await settingsPage.evaluate(() => window.api.window.close())
  await discard.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect.poll(() => settingsPage.isClosed()).toBe(true)
  await page.getByRole('button', { name: 'All references', exact: true }).click()
})

test('minimizes a literature preview, operates the main interface, and restores its reading state', async ({
  app
}, testInfo) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  const directory = await app.createTestDirectory('literature-preview-minimize')
  const file = join(directory, 'reading.pdf')
  const pdf = await PDFDocument.create()
  pdf.addPage([400, 600]).drawText('Preview remains mounted')
  await writeFile(file, await pdf.save())
  const item = await page.evaluate(
    (input) => window.api.literature.transact({ kind: 'create-item', item: input }),
    literatureItemInputSchema.parse({
      itemType: 'journalArticle',
      title: 'Minimize preview regression'
    })
  )
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('button', { name: 'All references', exact: true }).click()
  await page.getByText('Minimize preview regression', { exact: true }).click()
  await page.locator('input[aria-label="Add PDF"]').setInputFiles(file)
  await page.getByRole('button', { name: 'Preview reading.pdf', exact: true }).click()
  const preview = page.locator('[data-slot="file-preview-dialog"]')
  await expect(preview).toBeVisible()
  await preview.getByRole('tab', { name: 'Notes & Annotations', exact: true }).click()
  await preview.evaluate((element) =>
    element.setAttribute('data-minimize-retention-check', 'original')
  )
  await preview.getByRole('button', { name: 'Hide preview', exact: true }).click()
  await expect(preview).toBeHidden()
  expect(
    await page
      .locator('#root')
      .evaluate((element) => element instanceof HTMLElement && element.inert)
  ).toBe(false)
  // This main-interface control was inaccessible behind the fullscreen preview.
  await page.getByRole('button', { name: 'All references', exact: true }).click()
  await expect(page.getByText('Minimize preview regression', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Restore preview of/ }).click()
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('data-minimize-retention-check', 'original')
  await expect(
    preview.getByRole('tab', { name: 'Notes & Annotations', exact: true })
  ).toHaveAttribute('aria-selected', 'true')
  await preview.getByRole('tab', { name: 'Original PDF', exact: true }).click()
  await expect(preview.getByRole('tab', { name: 'Original PDF', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(preview).toHaveCSS('opacity', '1')
  await page.screenshot({ path: testInfo.outputPath('preview-restored.png') })
  // Clicking the surrounding area also returns to the main interface without closing the file.
  await page.mouse.click(8, 100)
  await expect(preview).toBeHidden()
  await page.getByRole('button', { name: /Restore preview of/ }).click()
  await expect(preview).toBeVisible()
  expect(
    (await page.evaluate((id) => window.api.literature.get(id), item.id))?.attachments
  ).toHaveLength(1)
})
