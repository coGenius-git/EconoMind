/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Removes orphaned i18n keys (translations whose English source string no longer exists anywhere in
// the non-test source tree) from the common and renderer namespaces of every translated locale.
// Uses exactly the algorithm of resources.test.ts "orphaned translations", so deleting a key here is
// exactly as safe as the test judging it orphaned. Run from repo root: node scripts/purge-orphan-i18n.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = join(root, 'src', 'shared', 'i18n', 'locales')
const LOCALES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh-Hans', 'zh-Hant']

const SCAN_ROOTS = [
  join(root, 'src', 'renderer', 'src'),
  join(root, 'src', 'renderer', 'web'),
  join(root, 'src', 'shared'),
  join(root, 'src', 'main')
]

/** @returns {Array<string>} */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'locales' ? [] : sourceFiles(path)
    if (!/\.tsx?$/.test(entry.name)) return []
    if (/\.(test|render\.test)\.tsx?$/.test(entry.name)) return []
    return [path]
  })
}

/** @returns {string} */
function unescape(raw) {
  return raw.replace(/\\(['"`\\nrt])/g, (_, char) =>
    char === 'n' ? '\n' : char === 'r' ? '\r' : char === 't' ? '\t' : char
  )
}

/** @returns {Array<string>} */
function literalsIn(source) {
  return [
    ...[...source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((match) => unescape(match[1])),
    ...[...source.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((match) => unescape(match[1])),
    ...[...source.matchAll(/`((?:[^`\\$]|\\.|\$(?!\{))*)`/g)].map((match) => unescape(match[1]))
  ]
}

const literals = new Set(
  SCAN_ROOTS.flatMap(sourceFiles).flatMap((path) => literalsIn(readFileSync(path, 'utf8')))
)

/** @returns {string} */
function englishOf(key) {
  return key.split('_')[0]
}

let purged = 0
for (const locale of LOCALES) {
  const path = join(localesDir, `${locale}.json`)
  const catalog = JSON.parse(readFileSync(path, 'utf8'))
  for (const namespace of ['common', 'renderer']) {
    const bucket = catalog[namespace]
    if (!bucket || typeof bucket !== 'object') continue
    for (const key of Object.keys(bucket)) {
      if (literals.has(englishOf(key))) continue
      delete bucket[key]
      purged += 1
      console.log(`purged ${locale}.${namespace}: ${key}`)
    }
  }
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
}
console.log(`purged ${purged} orphaned keys total`)
