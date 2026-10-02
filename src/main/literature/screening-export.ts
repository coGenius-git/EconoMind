import { strToU8, zipSync } from 'fflate'
import type { ScreeningDocument, ScreeningWorkflow } from '../../shared/literature-screening'
import { screeningEvidenceFilename } from '../../shared/literature-screening'
import template from './screening-report-template.json'

const xml = (s: string): string =>
  s
    .replace(
      /[&<>"']/gu,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!
    )
    // XML 1.0 forbids these control characters in text nodes.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, '')
type ReportLine = {
  text: string
  style?: 'Title' | 'Heading1' | 'Heading2' | 'ListBullet' | 'ListBullet2' | 'ListBullet3'
  label?: string
}
const run = (text: string, bold = false): string =>
  `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}${text
    .split('\n')
    .map((line) => `<w:t xml:space="preserve">${xml(line)}</w:t>`)
    .join('<w:br/>')}</w:r>`
const paragraph = ({ text, style, label }: ReportLine): string =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${style === 'Title' ? '<w:jc w:val="center"/>' : ''}</w:pPr>${label ? run(`${label}：`, true) : ''}${run(text)}</w:p>`

// Only formatting is retained from the user's workflow reports. Bundling the template
// also makes exports independent of local template paths in a packaged exe.
export function screeningDocx(title: string, lines: ReportLine[]): Uint8Array {
  const parts = ['styles', 'numbering', 'theme', 'settings', 'fontTable'] as const
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        parts
          .map(
            (p) =>
              `<Override PartName="/word/${p === 'theme' ? 'theme/theme1' : p}.xml" ContentType="application/vnd.openxmlformats-officedocument.${p === 'theme' ? 'theme' : `wordprocessingml.${p}`}+xml"/>`
          )
          .join('') +
        '</Types>'
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    ),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraph({ text: title, style: 'Title' })}${lines.map(paragraph).join('')}${template.section}</w:body></w:document>`
    ),
    'word/_rels/document.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        parts
          .map(
            (p, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${p}" Target="${p === 'theme' ? 'theme/theme1' : p}.xml"/>`
          )
          .join('') +
        '</Relationships>'
    ),
    'word/styles.xml': strToU8(template.styles),
    'word/numbering.xml': strToU8(template.numbering),
    'word/theme/theme1.xml': strToU8(template.theme),
    'word/settings.xml': strToU8(template.settings),
    'word/fontTable.xml': strToU8(template.fontTable)
  })
}
const safeName = (value: string): string => {
  const name =
    value
      .trim()
      // Windows filenames cannot contain control characters.
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_')
      .slice(0, 100)
      .replace(/[. ]+$/u, '') || '未命名'
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name) ? `_${name}` : name
}
const decision = (value?: string): string =>
  value === 'included' ? '保留' : value === 'excluded' ? '排除' : '未完成'
const field = (label: string, text: string, level = 1): ReportLine => ({
  label,
  text,
  style: level === 3 ? 'ListBullet3' : level === 2 ? 'ListBullet2' : 'ListBullet'
})
const metadata = (d: ScreeningDocument): ReportLine[] => [
  field('文件名', d.filename || '未提取'),
  field('作者', d.authors || '未提取'),
  field(
    '初版时间',
    d.initialPublicationDate || (d.year ? `未提取（文献年份：${d.year}）` : '未提取')
  ),
  field('DOI', d.doi || '未提取')
]
const evidenceLines = (
  d: ScreeningDocument,
  evidence: ScreeningDocument['evidence'],
  level = 1
): ReportLine[] =>
  evidence.length
    ? evidence.map((e, i) => {
        const location =
          e.matched && e.page
            ? `${d.sourceKind === 'pdf' ? 'PDF 页码' : '文本段落'}：${e.page}`
            : '定位待核对'
        // The template uses short locators. The audit record retains the full original quote.
        const chars = Array.from(e.quote)
        const excerpt = chars.length > 50 ? `${chars.slice(0, 49).join('')}…` : e.quote
        return field(
          i === 0 ? '原文定位' : '原文定位（续）',
          `详见：${excerpt}（${location}）`,
          i ? Math.min(level + 1, 3) : level
        )
      })
    : [field('原文定位', '暂无', level)]

export function buildScreeningExport(
  w: ScreeningWorkflow,
  screeningOnly: boolean,
  incompleteIds: string[],
  projectName = w.config.name
): { filename: string; base64: string; files: string[] } {
  const files: Record<string, Uint8Array> = {}
  const now = new Date()
  const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${now.toTimeString().slice(0, 8)}`
  const scope: ReportLine[] = [
    {
      text: incompleteIds.length
        ? `部分导出：${incompleteIds.length} 篇暂缓或未完成。\n${w.documents
            .filter((d) => incompleteIds.includes(d.id))
            .map((d) => `${d.title}：${d.error || (d.deferred ? '已暂缓' : '未完成')}`)
            .join('\n')}`
        : !screeningOnly && !w.extractionConfirmed
          ? '观点结果尚未确认；本次为部分导出。'
          : '本次范围内的结果已完成。'
    }
  ]
  // Reviewed decisions are authoritative; AI suggestions do not count as final results.
  const label = (d: ScreeningDocument): string => (d.deferred ? '未完成' : decision(d.decision))
  const ordered = [...w.documents].sort(
    (a, b) =>
      ['保留', '排除', '未完成'].indexOf(label(a)) - ['保留', '排除', '未完成'].indexOf(label(b)) ||
      (a.filename || a.title).localeCompare(b.filename || b.title, 'zh-CN')
  )
  files['screening_details.docx'] = screeningDocx('文献初筛明细报告', [
    { text: `生成时间：${time}\n状态文件：工作流记录.json\n文献总数：${w.documents.length}` },
    { text: '一、筛选汇总', style: 'Heading1' },
    ...['保留', '排除', '未完成'].map((value) => {
      const count = w.documents.filter((d) => label(d) === value).length
      return field(
        value,
        `${count} 篇（${(w.documents.length ? (count / w.documents.length) * 100 : 0).toFixed(1)}%）`
      )
    }),
    { text: '二、筛选明细', style: 'Heading1' },
    ...ordered.flatMap((d, i): ReportLine[] => [
      { text: `${i + 1}. ${d.title || d.filename || '未命名文献'}`, style: 'Heading2' },
      ...metadata(d),
      field('筛选结论', label(d)),
      field('筛选原因', d.note || d.reason || '暂无'),
      field(
        'AI 建议',
        `${d.screeningStatus === 'done' ? decision(d.suggestion) : '未完成'}；${d.reason || '尚未完成'}`
      ),
      field('复核备注', d.note || '无'),
      ...(d.deferred ? [field('处理状态', '已暂缓')] : []),
      ...evidenceLines(d, d.evidence)
    ]),
    {
      text: `导出范围：${scope[0].text}\n项目：${projectName}；筛选任务：${w.config.name}；配置版本：${w.revision}。筛选标准与完整复核记录见工作流记录.json。`
    }
  ])
  if (!screeningOnly)
    for (const [group, title] of [
      ['concepts', '关键概念'],
      ['relations', '概念间关系'],
      ['viewpoints', '观点整理']
    ] as const) {
      const usedNames = new Set<string>()
      for (const dimension of w.config[group]) {
        const records = w.documents
          .filter((d) => d.decision === 'included' && !d.deferred && d.extractionStatus === 'done')
          .flatMap((d) => {
            const finding = d.findings.find((f) => f.group === group && f.dimension === dimension)
            return finding?.hasContent ? [{ d, finding }] : []
          })
        const lines: ReportLine[] = [{ text: `生成时间：${time}\n条目数：${records.length}` }]
        records.forEach(({ d, finding }, i) => {
          lines.push(
            { text: `${i + 1}. ${d.title || d.filename || '未命名文献'}`, style: 'Heading1' },
            ...metadata(d),
            field(
              '整篇摘要',
              d.overallSummary || '未提取（旧版结果未保存整篇摘要，需重新提取后补全）'
            )
          )
          if (group === 'viewpoints') {
            if (!finding.points.length) lines.push(field('观点', '暂无'))
            finding.points.forEach((p, j) =>
              lines.push(
                field(`观点 ${j + 1}`, p.summary || '暂无'),
                ...evidenceLines(d, p.evidence, 2)
              )
            )
          } else {
            const evidence = finding.points
              .flatMap((p) => p.evidence)
              .filter(
                (e, j, all) =>
                  all.findIndex((other) => other.quote === e.quote && other.page === e.page) === j
              )
            lines.push(
              field(
                '观点概括',
                [...new Set(finding.points.map((p) => p.summary).filter(Boolean))].join('\n') ||
                  '暂无'
              ),
              ...evidenceLines(d, evidence)
            )
          }
        })
        if (!records.length) lines.push({ text: '本次导出范围内没有涉及该维度的已完成结果。' })
        // Keep scope information when separated from the archive, without repeating the
        // complete screening appendix in every dimension report.
        lines.push({
          text: `导出范围：${scope.at(-1)!.text}\n项目：${projectName}；配置版本：${w.revision}。完整复核记录见工作流记录.json。`
        })
        const base = safeName(dimension)
        let filename = `${base}.docx`,
          suffix = 2
        while (usedNames.has(filename.toLocaleLowerCase())) filename = `${base} (${suffix++}).docx`
        usedNames.add(filename.toLocaleLowerCase())
        files[`extraction_dimensions/${group}/${filename}`] = screeningDocx(
          `${title} - ${dimension}`,
          lines
        )
      }
    }
  files['工作流记录.json'] = strToU8(
    JSON.stringify(
      { ...w, export: { screeningOnly, incompleteIds, reportTemplate: 'literature-review-v2' } },
      null,
      2
    )
  )
  return {
    filename: screeningEvidenceFilename(projectName),
    base64: Buffer.from(zipSync(files)).toString('base64'),
    files: Object.keys(files)
  }
}
