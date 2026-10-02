/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

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

const z = JSON.parse(
  readFileSync(join(root, 'src', 'shared', 'i18n', 'locales', 'zh-Hans.json'), 'utf8')
)
/** @returns {string} */
function englishOf(key) {
  return key.split('_')[0]
}
const orphans = Object.keys(z.renderer).filter((key) => !literals.has(englishOf(key)))
console.log('orphan count:', orphans.length)
console.log(orphans.slice(0, 50).join('\n'))
