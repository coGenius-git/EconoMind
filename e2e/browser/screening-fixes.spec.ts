import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildScreeningExport } from '../../src/main/literature/screening-export'
import type { ScreeningWorkflow } from '../../src/shared/literature-screening'
import { WEB_CALLER_LOCATION_ATTRIBUTE } from '../../src/shared/web-caller-location'

test.use({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
  viewport: { width: 1440, height: 1000 }
})

test('uncertain references can be deferred while included references continue', async ({
  page
}) => {
  await page.goto('/screening.html?stage=3')
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  await page.getByRole('button', { name: '保留', exact: true }).click()
  await expect(page.getByRole('button', { name: '暂缓待定项并继续' })).toBeEnabled()
  await page.screenshot({ path: 'test-results/screening-unresolved.png' })
  await page.getByRole('button', { name: '暂缓待定项并继续' }).click()
  await expect(page.getByRole('button', { name: '提取已保留文献', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('screening setup no longer offers AI polishing', async ({ page }) => {
  await page.goto('/screening.html?stage=1')
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  await expect(page.getByRole('button', { name: /筛选设置/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI 润色设置', exact: true })).toHaveCount(0)
})

test('criteria conditions and matching modes survive save and reopen', async ({ page }) => {
  await page.goto('/screening.html?stage=1')
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  const inclusion = page.getByRole('group', { name: '纳入标准', exact: true })
  const exclusion = page.getByRole('group', { name: '排除标准', exact: true })
  await expect(inclusion.getByRole('radio', { name: '按原文判断' })).toBeChecked()
  await inclusion.getByRole('radio', { name: '全部满足' }).check()
  await page
    .getByRole('textbox', { name: '纳入标准第 1 条', exact: true })
    .fill('2011—2022 年发表的英文期刊论文。')
  await page.getByRole('button', { name: '添加纳入标准', exact: true }).click()
  await page
    .getByRole('textbox', { name: '纳入标准第 2 条', exact: true })
    .fill('分析强制非财务披露制度的原始实证研究。')
  await exclusion.getByRole('radio', { name: '任意一条' }).check()
  await page
    .getByRole('textbox', { name: '排除标准第 1 条', exact: true })
    .fill('仅研究自愿披露，没有强制披露冲击。')
  await page.getByRole('button', { name: '添加排除标准', exact: true }).click()
  await page
    .getByRole('textbox', { name: '排除标准第 2 条', exact: true })
    .fill('综述、评论或无原创实证分析。')
  await page
    .getByRole('textbox', { name: '排除标准补充说明与例外', exact: true })
    .fill('缺少全文或证据不足时先设为待定，暂不排除。')
  await page.getByRole('button', { name: '添加排除标准', exact: true }).click()
  await page.getByRole('button', { name: '删除排除标准第 3 条', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  await expect(inclusion.getByRole('radio', { name: '全部满足' })).toBeChecked()
  await expect(page.getByRole('textbox', { name: '排除标准第 2 条', exact: true })).toHaveValue(
    '综述、评论或无原创实证分析。'
  )
  await page.getByRole('button', { name: '保存并准备全文', exact: true }).click()
  await page.getByRole('button', { name: /筛选设置/ }).click()
  await expect(exclusion.getByRole('radio', { name: '任意一条' })).toBeChecked()
  await expect(
    page.getByRole('textbox', { name: '排除标准补充说明与例外', exact: true })
  ).toHaveValue('缺少全文或证据不足时先设为待定，暂不排除。')
  await expect(page.getByRole('textbox', { name: '排除标准第 3 条', exact: true })).toHaveCount(0)
  await inclusion.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/screening-criteria-cards.png' })
  await page.setViewportSize({ width: 820, height: 1000 })
  await exclusion.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/screening-criteria-cards-narrow.png' })
})

test('dimension rows preserve punctuation, draft edits and saved values', async ({ page }) => {
  await page.goto('/screening.html?stage=1')
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  await page.getByRole('button', { name: '添加关键概念', exact: true }).click()
  await page
    .getByRole('textbox', { name: '关键概念第 3 条', exact: true })
    .fill('CSR, ESG；企业责任')
  await page.getByRole('button', { name: '添加关键概念', exact: true }).click()
  await page.getByRole('textbox', { name: '关键概念第 4 条', exact: true }).fill('强制非财务披露')
  await page.getByRole('button', { name: '删除关键概念第 2 条', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  await expect(page.getByRole('textbox', { name: '关键概念第 2 条', exact: true })).toHaveValue(
    'CSR, ESG；企业责任'
  )
  await expect(page.getByRole('textbox', { name: '关键概念第 3 条', exact: true })).toHaveValue(
    '强制非财务披露'
  )
  await page.getByRole('button', { name: '添加关键概念', exact: true }).click()
  await page.getByRole('button', { name: '保存并准备全文', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/screening-dimension-inputs.png' })
  await page.getByRole('button', { name: '保存并准备全文', exact: true }).click()
  await page.getByRole('button', { name: /筛选设置/ }).click()
  await expect(page.getByRole('textbox', { name: '关键概念第 2 条', exact: true })).toHaveValue(
    'CSR, ESG；企业责任'
  )
  await expect(page.getByRole('textbox', { name: '关键概念第 3 条', exact: true })).toHaveValue(
    '强制非财务披露'
  )
  await expect(page.getByRole('textbox', { name: '关键概念第 4 条', exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 820, height: 1000 })
  await page.getByRole('button', { name: '添加研究观点', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/screening-dimension-inputs-narrow.png' })
})

test('previews generated Word evidence and audit record in the screening evidence package', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    // Trace snapshots inject scripts into every frame. The Word frame deliberately rejects them;
    // an untraced browser run produces no such errors. Keep all other console errors actionable.
    const traceInSandbox =
      message.text() ===
      "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set."
    if (message.type() === 'error' && !traceInSandbox) errors.push(message.text())
  })
  const screenshots = process.env.SCREENING_QA_DIR ?? join(tmpdir(), 'economind-word-preview')
  mkdirSync(screenshots, { recursive: true })
  await page.route('**/screening-export', async (route) => {
    const { workflow, screeningOnly, preview, partial } = route.request().postDataJSON() as {
      workflow: ScreeningWorkflow
      screeningOnly: boolean
      preview: boolean
      partial: boolean
    }
    const incomplete = workflow.documents
      .filter((d) => d.extractionStatus !== 'done')
      .map((d) => d.id)
    expect(preview || partial).toBe(true)
    await route.fulfill({ json: buildScreeningExport(workflow, screeningOnly, incomplete) })
  })
  await page.goto('/screening.html?stage=5&incomplete=1')
  await expect(page).toHaveTitle('EconoMind 文献筛选 · 界面验证')
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  await expect(page.getByRole('heading', { name: '筛选证据包', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '预览筛选证据包', exact: true }).click()
  const preview = page.getByRole('region', { name: '筛选证据包预览' })
  await expect(
    preview
      .frameLocator('iframe')
      .getByText(/Digital transformation improves corporate/)
      .first()
  ).toBeVisible()
  const firstPage = preview.frameLocator('iframe').locator('section.docx').first()
  await expect(preview.frameLocator('iframe').locator('script')).toHaveCount(0)
  const width = await firstPage.evaluate((element) => element.getBoundingClientRect().width)
  await preview.getByRole('button', { name: '放大', exact: true }).click()
  await expect
    .poll(() => firstPage.evaluate((element) => element.getBoundingClientRect().width))
    .toBeGreaterThan(width)
  await preview.getByRole('button', { name: '适应宽度', exact: true }).click()
  await expect
    .poll(() => firstPage.evaluate((element) => element.getBoundingClientRect().width))
    .toBeCloseTo(width, 0)
  await preview.scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(screenshots, 'word-preview-desktop.png') })
  await preview
    .getByRole('button', {
      name: 'extraction_dimensions/viewpoints/信息不对称机制.docx',
      exact: true
    })
    .click()
  await expect(
    preview
      .frameLocator('iframe')
      .getByText(/观点 1：数字化转型改善企业融资效率/)
      .first()
  ).toBeVisible()
  await preview.getByRole('button', { name: '展开预览面板', exact: true }).click()
  const expanded = page.getByRole('dialog', { name: '筛选证据包预览' })
  await expect(
    expanded
      .frameLocator('iframe')
      .getByText(/观点 1：数字化转型改善企业融资效率/)
      .first()
  ).toBeVisible()
  await page.screenshot({ path: join(screenshots, 'word-preview-fullscreen.png') })
  await expanded
    .frameLocator('iframe')
    .locator('body')
    .click({ position: { x: 10, y: 10 } })
  await page.keyboard.press('Escape')
  await expect(expanded).not.toBeVisible()
  await expect(preview.getByRole('button', { name: '展开预览面板', exact: true })).toBeFocused()
  await page.setViewportSize({ width: 820, height: 1000 })
  await preview.getByRole('combobox', { name: '导出文件' }).selectOption('screening_details.docx')
  await expect(
    preview.frameLocator('iframe').getByText('文献初筛明细报告', { exact: true })
  ).toBeVisible()
  await preview.scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(screenshots, 'word-preview-narrow.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await preview.getByRole('button', { name: '工作流记录.json', exact: true }).click()
  await expect(preview.locator('pre')).toContainText('"schemaVersion": 1')
  await expect(preview.locator('pre')).toContainText('"paper-1"')
  await page.getByRole('button', { name: '证据包另存为…', exact: true }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-export-saved', 'true')
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: '继续另存为', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-export-saved', 'true')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('large evidence reports keep the final paper readable', async ({ page }) => {
  await page.route('**/screening-export', async (route) => {
    const { workflow } = route.request().postDataJSON() as { workflow: ScreeningWorkflow }
    workflow.documents = Array.from({ length: 120 }, (_, index) => ({
      ...workflow.documents[0],
      id: `synthetic-${index + 1}`,
      title: `第 ${index + 1} 篇文献（预览压力测试数据）`
    }))
    await route.fulfill({ json: buildScreeningExport(workflow, false, []) })
  })
  await page.goto('/screening.html?stage=5')
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  await page.getByRole('button', { name: '预览筛选证据包', exact: true }).click()
  const preview = page.getByRole('region', { name: '筛选证据包预览' })
  const last = preview
    .frameLocator('iframe')
    .getByText('120. 第 120 篇文献（预览压力测试数据）', { exact: true })
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  await expect(preview.frameLocator('iframe').locator('section.docx').first()).toContainText(
    '文献总数：120'
  )
})

test('web save as preserves user activation before generating the ZIP', async ({ page }) => {
  await page.route('**/screening-export', async (route) => {
    const { workflow } = route.request().postDataJSON() as { workflow: ScreeningWorkflow }
    await expect(page.locator('html')).toHaveAttribute('data-picker-activated', 'true')
    await route.fulfill({ json: buildScreeningExport(workflow, true, []) })
  })
  await page.goto('/screening.html?stage=5')
  await page.getByRole('button', { name: /数字化转型与企业融资约束/ }).click()
  await page.getByRole('checkbox', { name: '仅导出筛选明细' }).check()
  await page.evaluate((attribute) => {
    document.documentElement.setAttribute(attribute, 'local')
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        document.documentElement.setAttribute(
          'data-picker-activated',
          String(navigator.userActivation.isActive)
        )
        return {
          name: '自选证据包.zip',
          createWritable: async () => ({
            write: async (bytes: Uint8Array) => {
              document.documentElement.setAttribute(
                'data-saved-zip',
                String(bytes[0] === 80 && bytes[1] === 75)
              )
            },
            close: async () => undefined,
            abort: async () => undefined
          })
        }
      }
    })
  }, WEB_CALLER_LOCATION_ATTRIBUTE)
  await page.getByRole('button', { name: '证据包另存为…', exact: true }).click()
  await expect(page.getByText('已保存到：自选证据包.zip', { exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-saved-zip', 'true')
  await expect(page.locator('html')).not.toHaveAttribute('data-export-saved', 'true')
})
