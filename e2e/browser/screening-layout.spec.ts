import { expect, test, type Page } from '@playwright/test'

test.use({ channel: process.platform === 'win32' ? 'msedge' : undefined })

const expectNoOuterOverflow = async (page: Page): Promise<void> => {
  // Absolute sr-only labels used to escape the form scroller and add a blank page below it.
  const layout = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    pageHeight: document.documentElement.scrollHeight,
    pageWidth: document.documentElement.scrollWidth,
    scrollY: window.scrollY
  }))
  expect(layout.pageHeight).toBeLessThanOrEqual(layout.viewportHeight + 1)
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1)
  expect(layout.scrollY).toBe(0)
  await expect(page.getByRole('button', { name: '返回文献库', exact: true })).toBeInViewport()
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 820, height: 1000 }
]) {
  test(`screening setup has no blank outer page at ${viewport.width}px`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/screening.html?stage=1')
    await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
    await expectNoOuterOverflow(page)

    const save = page.getByRole('button', { name: '保存并准备全文', exact: true })
    await save.scrollIntoViewIfNeeded()
    await expect(save).toBeInViewport()
    await expectNoOuterOverflow(page)

    // Growing and shrinking the form must keep labels associated with their inputs and confined.
    await page.getByRole('button', { name: '添加关键概念', exact: true }).click()
    await page.getByRole('textbox', { name: '关键概念第 3 条', exact: true }).fill('融资效率')
    await save.scrollIntoViewIfNeeded()
    await expectNoOuterOverflow(page)
    await page.getByRole('button', { name: '删除关键概念第 3 条', exact: true }).click()
    await save.scrollIntoViewIfNeeded()
    await expectNoOuterOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('screening-layout.png') })
  })
}
