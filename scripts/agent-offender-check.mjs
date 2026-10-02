/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const localesDir = join(root, 'src', 'shared', 'i18n', 'locales')

/** @returns {string} */
function withoutTechnicalIdentifiers(text) {
  return text
    .split(
      /<code>.*?<\/code>|\{\{\w+\}\}|<\/?\w+>|https?:\/\/\S+|\b[A-Za-z]:\\[\w.\\-]*(?<!\.)|[A-Za-z0-9_-]+@[A-Za-z0-9.-]+/g
    )
    .join(' ')
}

/** @returns {object} */
function catalog(locale) {
  const json = JSON.parse(readFileSync(join(localesDir, `${locale}.json`), 'utf8'))
  return { ...json.common, ...json.renderer }
}

/** @returns {string} */
function englishOf(key) {
  return key.split('_')[0]
}

const EXPECTED = {
  de: { agent: /agent/iu, untranslatedAgent: /\bsubagents?\b/i },
  es: { agent: /agentes?/iu, untranslatedAgent: /\b(?:sub)?agents?\b/i },
  fr: { agent: 'agent', untranslatedAgent: /\bsubagents?\b/i },
  ja: { agent: 'エージェント', untranslatedAgent: /\b(?:sub)?agents?\b/i },
  ko: { agent: '에이전트', untranslatedAgent: /\b(?:sub)?agents?\b/i },
  ru: { agent: /агент/iu, untranslatedAgent: /\b(?:sub)?agents?\b/i }
}

for (const locale of ['de', 'es', 'fr', 'ja', 'ko', 'ru']) {
  const expected = EXPECTED[locale]
  const offenders = Object.entries(catalog(locale)).flatMap(([key, value]) => {
    const source = withoutTechnicalIdentifiers(englishOf(key))
    const prose = withoutTechnicalIdentifiers(value)
    const hit =
      /\b(?:sub)?agents?\b/i.test(source) &&
      (!(typeof expected.agent === 'string'
        ? prose.toLocaleLowerCase(locale).includes(expected.agent.toLocaleLowerCase(locale))
        : expected.agent.test(prose)) ||
        expected.untranslatedAgent.test(prose))
    return hit ? [key] : []
  })
  console.log(locale, 'agent offenders:', offenders)
}
