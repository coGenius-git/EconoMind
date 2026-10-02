// One-off fix for 3 remaining i18n failures
import { readFileSync, writeFileSync } from 'node:fs'

const ko = JSON.parse(readFileSync('src/shared/i18n/locales/ko.json', 'utf8'))
const koMap = {
  'Project category general': '일반 프로젝트',
  'Project category economics': '경제 연구 프로젝트',
  'Project category management': '경영 연구 프로젝트',
  'Project category finance': '금융 연구 프로젝트',
  'Project category accounting': '회계 연구 프로젝트',
  'Project category case study': '사례 연구 프로젝트'
}
for (const [k, v] of Object.entries(koMap)) ko.renderer[k] = v
writeFileSync('src/shared/i18n/locales/ko.json', `${JSON.stringify(ko, null, 2)}\n`, 'utf8')

const fr = JSON.parse(readFileSync('src/shared/i18n/locales/fr.json', 'utf8'))
fr.renderer[
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.'
] =
  'Exécutez un flux de sélection en cinq étapes: mots-clés, sources, importation, analyse et le tableau de sélection.'
fr.renderer[
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.'
] =
  "Choisissez d'où proviennent les enregistrements. Crossref et OpenAlex sont disponibles via la compétence littérature; arXiv et les moteurs de texte intégral sont utilisés lorsque c'est pris en charge."
fr.renderer[
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.'
] =
  "Google Scholar n'a pas d'API ouverte; Semantic Scholar peut être ajouté comme connecteur personnalisé."
writeFileSync('src/shared/i18n/locales/fr.json', `${JSON.stringify(fr, null, 2)}\n`, 'utf8')

const es = JSON.parse(readFileSync('src/shared/i18n/locales/es.json', 'utf8'))
es.renderer[
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.'
] =
  'Elija de dónde se obtienen los registros. Crossref y OpenAlex están disponibles a través de la habilidad de literatura; arXiv y los buscadores de texto completo se usan donde se admiten.'
writeFileSync('src/shared/i18n/locales/es.json', `${JSON.stringify(es, null, 2)}\n`, 'utf8')

console.log('done')
