// Modified by EconoMind contributors: verify derivative attribution in packaged resources.
// Based on AIPOCH Open Science; see LICENSE and NOTICE.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import type { Configuration } from 'electron-builder'
import { load } from 'js-yaml'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
const { copyFiles, getFileMatchers } = builderRequire('app-builder-lib/out/fileMatcher')

it.each(['mac', 'win', 'linux'] as const)(
  'copies the original license and derivative notices outside app.asar for %s',
  async (platform) => {
    const root = resolve(__dirname, '..')
    const config = load(await readFile(join(root, 'electron-builder.yml'), 'utf8')) as Configuration
    const destination = await mkdtemp(join(tmpdir(), 'economind-license-'))
    const noticeFiles = [
      ['LICENSE', 'LICENSE.txt'],
      ['NOTICE', 'NOTICE.txt'],
      ['UPSTREAM.md', 'UPSTREAM.md'],
      ['docs/OPEN_SOURCE.md', 'OPEN_SOURCE.md'],
      ['src/renderer/src/assets/provider-icons/LobeHub-icons-LICENSE', 'LobeHub-icons-LICENSE']
    ]

    try {
      const matchers = getFileMatchers(config, 'extraResources', destination, {
        defaultSrc: root,
        macroExpander: (value) => value,
        customBuildOptions: config[platform] ?? {},
        globalOutDir: join(root, 'dist')
      })
      const licenses = matchers?.filter((matcher: { from: string }) =>
        noticeFiles.some(([source]) => matcher.from === join(root, source))
      )
      expect(licenses).toHaveLength(noticeFiles.length)
      await copyFiles(licenses)
      for (const [source, target] of noticeFiles) {
        expect(await readFile(join(destination, target), 'utf8')).toBe(
          await readFile(join(root, source), 'utf8')
        )
      }
    } finally {
      await rm(destination, { recursive: true, force: true })
    }
  }
)

it('exposes the license in the DMG while retaining both drag-to-install items', async () => {
  const root = resolve(__dirname, '..')
  const config = load(await readFile(join(root, 'electron-builder.yml'), 'utf8')) as Configuration
  const contents = config.dmg?.contents ?? []
  expect(contents.filter((item) => !item.path)).toHaveLength(1)
  expect(contents).toContainEqual(expect.objectContaining({ type: 'link', path: '/Applications' }))
  const license = contents.find((item) => item.name === 'LICENSE.txt')
  expect(license?.type).toBe('file')
  expect(await readFile(join(root, license!.path!), 'utf8')).toBe(
    await readFile(join(root, 'LICENSE'), 'utf8')
  )
})

it('installs Debian copyright metadata through the package file manifest', async () => {
  const root = resolve(__dirname, '..')
  const config = load(await readFile(join(root, 'electron-builder.yml'), 'utf8')) as Configuration
  const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const destination = `/usr/share/doc/${metadata.name}/copyright`
  const mapping = config.deb?.fpm?.find((argument) => argument.endsWith(`=${destination}`))
  expect(mapping).toBeDefined()
  const copyright = await readFile(join(root, mapping!.split('=')[0]), 'utf8')
  expect(copyright).toContain('Copyright: 2026 AIPOCH')
  expect(copyright).toContain('2026 EconoMind contributors (modifications)')
  expect(copyright).toContain('License: Apache-2.0')
  expect(copyright).toContain('/usr/share/common-licenses/Apache-2.0')
})

it('retains the original copyright and identifies EconoMind as a modified distribution', async () => {
  const root = resolve(__dirname, '..')
  const license = await readFile(join(root, 'LICENSE'), 'utf8')
  const notice = await readFile(join(root, 'NOTICE'), 'utf8')
  expect(license).toContain('Copyright 2026 AIPOCH')
  expect(license).toContain('END OF TERMS AND CONDITIONS')
  expect(notice).toContain('This product is derived from Open Science by AIPOCH.')
  expect(notice).toContain('Modifications Copyright 2026 EconoMind contributors')
  expect(notice).toContain('does not change the terms')
})

it('does not ship an upstream auto-update feed in either EconoMind distribution config', async () => {
  const root = resolve(__dirname, '..')
  for (const file of ['electron-builder.yml', 'electron-builder.share.yml']) {
    const config = load(await readFile(join(root, file), 'utf8')) as Configuration
    expect(config.publish).toBeNull()
  }
})

it('uses the original license with informational NSIS copy and a normal Next button', async () => {
  const root = resolve(__dirname, '..')
  const config = load(await readFile(join(root, 'electron-builder.yml'), 'utf8')) as Configuration
  expect(config.nsis?.oneClick).toBe(false)
  expect(await readFile(join(root, config.nsis!.license!), 'utf8')).toBe(
    await readFile(join(root, 'LICENSE'), 'utf8')
  )
  const include = await readFile(join(root, config.nsis!.include!), 'utf8')
  expect(include).toContain('!include "${BUILD_RESOURCES_DIR}\\installer.nsh"')
  expect(include).not.toContain('!include "${BUILD_RESOURCES_DIR}/installer.nsh"')
  expect(include).toContain('!macro customWelcomePage')
  expect(include).toContain('!define MUI_LICENSEPAGE_BUTTON "$(^NextBtn)"')
  for (const setting of [
    'MUI_PAGE_HEADER_TEXT',
    'MUI_PAGE_HEADER_SUBTEXT',
    'MUI_LICENSEPAGE_TEXT_TOP',
    'MUI_LICENSEPAGE_TEXT_BOTTOM'
  ]) {
    expect(include).toContain(`!define ${setting} `)
  }
  expect(include).not.toMatch(/!define MUI_LICENSEPAGE_(CHECKBOX|RADIOBUTTONS)\b/)
  expect(include).not.toMatch(/WriteReg|WriteINIStr/)
})
