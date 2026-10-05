import { expect } from '@playwright/test'
import { test } from './fixtures/electron-app'

test.use({ windowMode: 'normal' })

test('switches workbench modules without blank frames and preserves a research draft', async ({
  app
}, testInfo) => {
  const page = await app.completeOnboarding()
  await page.evaluate(() => window.api.locale.setPreference({ preference: 'en' }))
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeVisible()
  const samples: Array<{
    module: string
    durationMs: number
    blankFrames: number
    frames: number
  }> = []
  const navigate = async (module: string, ready: () => Promise<unknown>): Promise<void> => {
    await page.evaluate(() => {
      const probe = { start: 0, durationMs: 0, blankFrames: 0, frames: 0, active: false }
      ;(window as unknown as { navigationProbe: typeof probe }).navigationProbe = probe
      document.addEventListener(
        'click',
        () => {
          probe.start = performance.now()
          probe.active = true
          const sample = (): void => {
            if (!probe.active) return
            probe.frames++
            // Suspense retains the old page hidden while showing its fallback. Count a frame as
            // blank only when neither the retained page nor the loading shell has visible navigation.
            const visibleNavigation = Array.from(
              document.querySelectorAll<HTMLElement>('nav[aria-label="Workbench modules"]')
            ).some((navigation) => navigation.checkVisibility())
            if (!visibleNavigation) probe.blankFrames++
            requestAnimationFrame(sample)
          }
          requestAnimationFrame(sample)
        },
        { once: true, capture: true }
      )
    })
    await page
      .getByRole('navigation', { name: 'Workbench modules' })
      .getByRole('button', { name: module, exact: true })
      .click()
    await ready()
    const sample = await page.evaluate(() => {
      const probe = (
        window as unknown as {
          navigationProbe: {
            start: number
            durationMs: number
            blankFrames: number
            frames: number
            active: boolean
          }
        }
      ).navigationProbe
      probe.active = false
      probe.durationMs = performance.now() - probe.start
      return { durationMs: probe.durationMs, blankFrames: probe.blankFrames, frames: probe.frames }
    })
    samples.push({ module, ...sample })
    console.log(JSON.stringify({ navigationSample: { module, ...sample } }))
    expect(sample.blankFrames).toBe(0)
  }
  const libraryReady = (): Promise<void> =>
    expect(page.getByRole('heading', { name: 'Literature library', exact: true })).toBeVisible()
  const homeReady = (): Promise<void> =>
    expect(page.getByRole('button', { name: 'New project', exact: true })).toBeVisible()
  const workspaceReady = (): Promise<void> =>
    expect(page.getByRole('heading', { name: 'New conversation', exact: true })).toBeVisible()
  await navigate('Library', libraryReady)
  await navigate('Research home', homeReady)
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  const project = page.getByRole('dialog', { name: 'New project', exact: true })
  await project.getByLabel('Name', { exact: true }).fill('Navigation regression')
  await project.getByRole('button', { name: 'Create project', exact: true }).click()
  await workspaceReady()
  await page
    .getByRole('textbox', { name: 'Ask anything', exact: true })
    .fill('Keep my research draft')
  await page.getByRole('textbox', { name: 'Ask anything', exact: true }).evaluate((element) => {
    element.closest('main')!.setAttribute('data-workspace-retention-check', 'original')
  })
  await navigate('Library', libraryReady)
  await expect(page.locator('[data-workspace-retention-check="original"]')).toBeHidden()
  await navigate('Research workspace', workspaceReady)
  await expect(page.locator('[data-workspace-retention-check="original"]')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Ask anything', exact: true })).toHaveText(
    'Keep my research draft'
  )
  for (let i = 0; i < 2; i++) {
    await navigate('Research home', homeReady)
    await navigate('Research workspace', workspaceReady)
    await expect(page.locator('[data-workspace-retention-check="original"]')).toBeVisible()
    await navigate('Library', libraryReady)
  }
  await page.screenshot({ path: testInfo.outputPath('library-navigation.png') })
  await testInfo.attach('module-navigation-timings', {
    body: JSON.stringify(samples, null, 2),
    contentType: 'application/json'
  })
  console.log(JSON.stringify({ navigationSamples: samples }))
})

test('reuses the transcript when returning from Home and Library with saved research history', async ({
  app
}, testInfo) => {
  let page = await app.completeOnboarding()
  const cwd = await app.createTestDirectory('navigation-history')
  await page.evaluate(async (cwd) => {
    await window.api.locale.setPreference({ preference: 'en' })
    const project = await window.api.projects.create({
      name: 'Saved navigation history',
      description: ''
    })
    const now = Date.now() - 10000
    await window.api.sessions.saveSession({
      id: 'navigation-history',
      projectId: project.id,
      title: 'Saved research history',
      cwd,
      status: 'idle',
      createdAt: now,
      updatedAt: now,
      messages: Array.from({ length: 120 }, (_, index) => ({
        id: `history-${index}`,
        role: index % 2 ? ('agent' as const) : ('user' as const),
        content:
          index % 2
            ? `## Research result ${index}\n\n` + 'Evidence and interpretation. '.repeat(40)
            : `Research question ${index}`,
        status: 'complete' as const,
        eventIds: [],
        createdAt: now + index,
        updatedAt: now + index
      }))
    })
  }, cwd)
  page = await app.restart()
  const nav = page.getByRole('navigation', { name: 'Workbench modules', exact: true })
  await nav.getByRole('button', { name: 'Research home', exact: true }).click()
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeVisible()
  await nav.getByRole('button', { name: 'Research workspace', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Saved research history$/ })).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Ask anything', exact: true })
    .evaluate((element) =>
      element.closest('main')!.setAttribute('data-workspace-retention-check', 'saved')
    )
  const durations: number[] = []
  for (const module of ['Library', 'Research home']) {
    await nav.getByRole('button', { name: module, exact: true }).click()
    await expect(page.locator('[data-workspace-retention-check="saved"]')).toBeHidden()
    await page.evaluate(() => {
      const probe = { start: 0, readyMs: undefined as number | undefined }
      ;(window as unknown as { historyNavigationProbe: typeof probe }).historyNavigationProbe =
        probe
      document.addEventListener(
        'click',
        () => {
          probe.start = performance.now()
          const frame = (): void => {
            const main = document.querySelector<HTMLElement>(
              '[data-workspace-retention-check="saved"]'
            )
            if (main?.checkVisibility()) probe.readyMs = performance.now() - probe.start
            else requestAnimationFrame(frame)
          }
          requestAnimationFrame(frame)
        },
        { once: true, capture: true }
      )
    })
    await nav.getByRole('button', { name: 'Research workspace', exact: true }).click()
    await expect(page.locator('[data-workspace-retention-check="saved"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Saved research history$/ })).toBeVisible()
    const duration = await page.evaluate(
      () =>
        (window as unknown as { historyNavigationProbe: { readyMs?: number } })
          .historyNavigationProbe.readyMs
    )
    expect(duration).toBeDefined()
    expect(duration!).toBeLessThan(1000)
    durations.push(duration!)
  }
  await testInfo.attach('saved-history-navigation-timings', {
    body: JSON.stringify(durations),
    contentType: 'application/json'
  })
  console.log(JSON.stringify({ savedHistoryReturnMs: durations }))
})
