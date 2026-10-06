import type { TFunction } from 'i18next'
import type { SpecialistListItem } from '../../../../shared/specialist'

// Stable builtin IDs keep examples independent of display names and custom profiles.
export const builtinSpecialistExample = (
  item: SpecialistListItem | undefined,
  t: TFunction
): string | undefined => {
  if (item?.kind !== 'builtin' || !item.enabled) return undefined
  switch (item.id) {
    case 'literature-agent':
      return t(
        'I am researching “[how enterprise digital transformation affects innovation performance]”. Find literature within this scope:\n- Years: [2015 to the present], with earlier foundational studies when needed.\n- Disciplines: [economics, management, finance and accounting].\n- Languages: [Chinese and English].\n- Population and region: [Chinese enterprises, with relevant international research].\n- Types: [journal articles and working papers; exclude news, theses and general commentary].\n- Sources: [CNKI, Web of Science, Google Scholar and public scholarly databases, subject to actual access].\n- Selection: [about 20 papers, prioritize relevance and research quality over citation counts or journal rankings].\n\nDevelop Chinese and English search terms, find representative and recent studies, and trace references and subsequent citations. Provide a table of titles, authors, years, venues, research questions, findings, relevance and accessible links. Verify bibliographic details, mark full-text availability, and record search queries, dates and coverage, including inaccessible requested sources.'
      )
    case 'literature-review-agent':
      return t(
        'Write a literature review on “[how enterprise digital transformation affects innovation performance]” using the papers I upload or specify.\n\nOrganize the review by theory, mechanisms and methods. Compare agreement, disagreement and applicability rather than listing abstracts. Explain limitations and evidence-supported directions for further research.\n\nFirst provide a literature comparison table, then a draft with citations. Trace claims to verifiable sources, distinguish abstract-only reading from verified full text, and list specific gaps requiring additional papers.'
      )
    case 'methodology-agent':
      return t(
        'I want to study “[whether enterprise digital transformation promotes innovation performance]” using [annual data on Chinese listed companies from 2015 to 2025]. Develop an executable research design.\n\nDefine constructs and variable measurements, compare suitable methods, and explain identification assumptions, endogeneity risks, diagnostics and robustness analyses.\n\nIf my data are sufficient, write and run analysis code. Otherwise provide the design, a data requirements table and a code skeleton explicitly marked as not executed.'
      )
    case 'data-agent':
      return t(
        'Audit and prepare my uploaded [enterprise annual panel data] for research on “[enterprise digital transformation and innovation performance]”.\n\nCheck observation units, years, definitions and measurement units; diagnose duplicate keys, missing values, outliers and merge matching. Then produce appropriate descriptive statistics and charts.\n\nPreserve the original data. Save cleaned copies and provide reproducible code, a data dictionary and sample-flow records. Explain the rationale and alternatives before treatments that materially change the sample or conclusions.'
      )
    case 'review-agent':
      return t(
        'Review my uploaded [paper draft / research proposal], focusing on the research question and contribution, theory, methods and data, interpretation and whether citations support the claims.\n\nRank findings by impact. For each finding, identify its location, evidence and actionable correction, prioritizing issues affecting the main conclusions.\n\nIf I provide data and code, verify key results against the text, tables and figures. For now provide review comments and preserve the original. Separately identify material that was not provided or could not be verified.'
      )
    default:
      return undefined
  }
}
