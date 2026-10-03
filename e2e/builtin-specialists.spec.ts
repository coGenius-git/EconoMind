import { expect } from '@playwright/test'
import { createProject, openProjectSession, sendPrompt } from './certification/helpers'
import { test } from './fixtures/electron-app'

const bundledIds = ['literature-agent', 'methodology-agent', 'data-agent', 'review-agent'] as const

for (const specialistId of bundledIds) {
  test(`selects, runs and restores the bundled ${specialistId}`, async ({ app }, testInfo) => {
    test.setTimeout(180_000)
    await app.completeOnboarding()
    let page = await app.configureFakeAgent()
    const projectName = `Builtin ${specialistId} regression`
    await createProject(page, projectName)

    const specialists = await page.evaluate(async () =>
      (await window.api.specialist.list()).items.filter((item) => item.kind === 'builtin')
    )
    expect(specialists.map((item) => item.id).sort()).toEqual([...bundledIds].sort())
    const selected = specialists.find((item) => item.id === specialistId)!
    expect(selected.selectedCapabilities.skillIds.length).toBeGreaterThan(0)
    await page.getByRole('button', { name: /Agent controls:/ }).click()
    await page.getByTestId('specialist-submenu-trigger').press('ArrowRight')
    await page.getByTestId(`specialist-option-${specialistId}`).click()
    await page.getByRole('textbox', { name: 'Ask anything' }).fill('Check Specialist availability.')
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled()
    await expect(page.getByTestId('composer-specialist-picker-trigger')).toHaveAttribute(
      'aria-label',
      `Choose Specialist: ${selected.displayName ?? selected.name}`
    )

    const prompt = `Verify bundled Specialist identity: ${specialistId}.`
    const reply = 'Bundled Specialist identity verified.'
    await sendPrompt(page, prompt, reply)
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await window.api.sessions.loadAll()).sessions.map((session) => session.specialistId)
        )
      )
      .toContain(specialistId)
    await page.screenshot({ path: testInfo.outputPath('builtin-specialist-conversation.png') })

    page = await app.restart()
    await openProjectSession(page, projectName, prompt)
    await expect(page.getByTestId('composer-specialist-picker-trigger')).toHaveAttribute(
      'aria-label',
      `Choose Specialist: ${selected.displayName ?? selected.name}`
    )
    await sendPrompt(page, prompt, reply)
  })
}
