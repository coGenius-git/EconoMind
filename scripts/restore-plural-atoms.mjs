import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const locales = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh-Hans', 'zh-Hant']
let n = 0
for (const loc of locales) {
  const head = JSON.parse(
    execFileSync('git', ['show', `HEAD:src/shared/i18n/locales/${loc}.json`], { encoding: 'utf8' })
  )
  const path = `src/shared/i18n/locales/${loc}.json`
  const cur = JSON.parse(readFileSync(path, 'utf8'))
  for (const ns of ['common', 'renderer']) {
    const b = head[ns]
    if (!b) continue
    for (const key of Object.keys(b)) {
      if (
        key.startsWith('{{count}} atoms') &&
        typeof cur[ns]?.[key] !== 'string' &&
        typeof b[key] === 'string'
      ) {
        cur[ns] = cur[ns] ?? {}
        cur[ns][key] = b[key]
        n += 1
      }
    }
  }
  writeFileSync(path, `${JSON.stringify(cur, null, 2)}\n`, 'utf8')
}
console.log('restored plural variants:', n)
