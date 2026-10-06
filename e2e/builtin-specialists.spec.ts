import { expect } from '@playwright/test'
import { createProject, openProjectSession, sendPrompt } from './certification/helpers'
import { test } from './fixtures/electron-app'

const bundledIds = [
  'literature-agent',
  'literature-review-agent',
  'methodology-agent',
  'data-agent',
  'review-agent'
] as const

const exampleMarkers = {
  'literature-agent': 'Find literature within this scope:',
  'literature-review-agent': 'Write a literature review on',
  'methodology-agent': 'Develop an executable research design.',
  'data-agent': 'Audit and prepare my uploaded',
  'review-agent': 'Review my uploaded'
}

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
    await expect(page.getByRole('textbox', { name: 'Ask anything' })).toContainText(
      exampleMarkers[specialistId]
    )
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

test('switches examples through both menus and preserves an edited draft', async ({
  app
}, testInfo) => {
  test.setTimeout(180_000)
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await createProject(page, 'Specialist example drafts')
  const composer = page.getByRole('textbox', { name: 'Ask anything' })

  await page.getByRole('button', { name: /Agent controls:/ }).click()
  await page.getByTestId('specialist-submenu-trigger').press('ArrowRight')
  await page.getByTestId('specialist-option-literature-agent').click()
  await expect(composer).toContainText(exampleMarkers['literature-agent'])
  await expect(composer).toContainText('Years: [2015 to the present]')
  await expect(composer).toContainText('Sources: [CNKI, Web of Science, Google Scholar')
  await page.screenshot({ path: testInfo.outputPath('literature-search-example.png') })

  await page.getByTestId('composer-specialist-picker-trigger').click()
  await page.getByTestId('composer-specialist-option-literature-review-agent').click()
  await expect(composer).toContainText(exampleMarkers['literature-review-agent'])
  await page.screenshot({ path: testInfo.outputPath('literature-review-example.png') })
  // A selection is a local draft operation: it must not create a conversation or call a model.
  expect((await page.evaluate(() => window.api.sessions.loadAll())).sessions).toHaveLength(0)

  await composer.fill('My edited research question')
  await page.getByTestId('composer-specialist-picker-trigger').click()
  await page.getByTestId('composer-specialist-option-data-agent').click()
  await expect(composer).toHaveText('My edited research question')
  await page.getByTestId('composer-specialist-picker-trigger').click()
  await page.getByTestId('composer-specialist-option-__main-agent-option').click()
  await expect(composer).toHaveText('My edited research question')

  await composer.fill('')
  await page.getByRole('button', { name: /Agent controls:/ }).click()
  await page.getByTestId('specialist-submenu-trigger').press('ArrowRight')
  await page.getByTestId('specialist-option-methodology-agent').click()
  await expect(composer).toContainText(exampleMarkers['methodology-agent'])
  for (const id of ['data-agent', 'review-agent'] as const) {
    await page.getByTestId('composer-specialist-picker-trigger').click()
    await page.getByTestId(`composer-specialist-option-${id}`).click()
    await expect(composer).toContainText(exampleMarkers[id])
  }
  await page.getByTestId('composer-specialist-picker-trigger').click()
  await page.getByTestId('composer-specialist-option-__main-agent-option').click()
  await expect(composer).toBeEmpty()

  await page.evaluate(() => window.api.locale.setPreference({ preference: 'zh-Hans' }))
  await page.getByTestId('composer-controls-trigger').click()
  await page.getByTestId('specialist-submenu-trigger').press('ArrowRight')
  await page.getByTestId('specialist-option-literature-agent').click()
  const chineseComposer = page.getByRole('textbox', { name: '输入任何内容', exact: true })
  await expect(chineseComposer).toContainText('时间范围：[2015年至今]')
  await expect(chineseComposer).toContainText('来源范围：[优先检索知网')
  await page.screenshot({ path: testInfo.outputPath('literature-search-example-zh.png') })
  await page.getByTestId('composer-specialist-picker-trigger').click()
  await page.getByTestId('composer-specialist-option-literature-review-agent').click()
  await expect(chineseComposer).toContainText('基于我上传或指定的文献撰写一份文献综述')
  await page.screenshot({ path: testInfo.outputPath('literature-review-example-zh.png') })
})

test('switches restored examples and clears the prompt when starting a new conversation', async ({
  app
}) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  const projectName = 'Restored Specialist drafts'
  await createProject(page, projectName)
  const composer = page.getByRole('textbox', { name: 'Ask anything' })
  const chooseSpecialist = async (id: string): Promise<void> => {
    await page.getByTestId('composer-controls-trigger').click()
    await page.getByTestId('specialist-submenu-trigger').press('ArrowRight')
    await page.getByTestId(`specialist-option-${id}`).click()
  }
  const returnToProject = async (): Promise<void> => {
    await page.getByRole('button', { name: 'All projects', exact: true }).click()
    await page
      .getByRole('region', { name: 'Projects', exact: true })
      .getByRole('button', { name: projectName, exact: true })
      .click()
  }
  await chooseSpecialist('literature-agent')
  await expect(composer).toContainText(exampleMarkers['literature-agent'])

  // Leaving the workspace remounts the panel, while its composer draft survives navigation.
  await returnToProject()
  await expect(composer).toContainText(exampleMarkers['literature-agent'])
  await chooseSpecialist('literature-review-agent')
  await expect(composer).toContainText(exampleMarkers['literature-review-agent'])

  await page.getByRole('button', { name: 'New', exact: true }).click()
  await expect(composer).toBeEmpty()
  await chooseSpecialist('data-agent')
  await expect(composer).toContainText(exampleMarkers['data-agent'])
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await expect(composer).toBeEmpty()
  await returnToProject()
  await expect(composer).toBeEmpty()
  expect((await page.evaluate(() => window.api.sessions.loadAll())).sessions).toHaveLength(0)
})

test('prefills after an existing conversation changes Specialist', async ({ app }) => {
  test.setTimeout(180_000)
  await app.completeOnboarding()
  const page = await app.configureFakeAgent()
  await createProject(page, 'Existing Specialist example')
  const composer = page.getByRole('textbox', { name: 'Ask anything' })
  await page.getByRole('button', { name: /Agent controls:/ }).click()
  await page.getByTestId('specialist-submenu-trigger').press('ArrowRight')
  await page.getByTestId('specialist-option-literature-agent').click()
  await sendPrompt(
    page,
    'Verify bundled Specialist identity: literature-agent.',
    'Bundled Specialist identity verified.'
  )
  await expect(composer).toBeEmpty()
  await page.getByTestId('composer-specialist-picker-trigger').click()
  await page.getByTestId('composer-specialist-option-literature-review-agent').click()
  await expect(composer).toContainText(exampleMarkers['literature-review-agent'])
  await page.getByTestId('composer-specialist-picker-trigger').click()
  await page.getByTestId('composer-specialist-option-__main-agent-option').click()
  await expect(composer).toBeEmpty()
})
