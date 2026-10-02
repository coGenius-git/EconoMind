import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { screeningWorkflowSchema, type ScreeningWorkflow } from '../../shared/literature-screening'
import { buildScreeningExport } from './screening-export'

const evidence = [
  { quote: '债务融资使企业能够扩大投资规模。', page: 2, matched: true },
  { quote: '杠杆水平上升可能放大现金流波动。', page: 3, matched: true }
]
export const reportFixture = (): ScreeningWorkflow =>
  screeningWorkflowSchema.parse({
    schemaVersion: 1,
    id: '11000000-0000-4000-8000-000000000001',
    projectId: 'project',
    revision: 1,
    stage: 5,
    parseConfirmed: true,
    screeningConfirmed: true,
    extractionConfirmed: true,
    config: {
      name: '筛选任务',
      topic: '财务杠杆与企业韧性',
      inclusion: '企业层面的杠杆研究',
      exclusion: '与企业融资无关',
      concepts: ['财务杠杆'],
      relations: ['杠杆与风险'],
      viewpoints: ['风险放大机制']
    },
    documents: [
      {
        id: 'paper',
        title: '用于验证报告模板的示例文献',
        authors: '示例作者甲, 示例作者乙',
        year: 2025,
        initialPublicationDate: '2025-03-01',
        doi: '10.0000/example',
        filename: '模板测试.pdf',
        parseStatus: 'done',
        screeningStatus: 'done',
        extractionStatus: 'done',
        suggestion: 'included',
        decision: 'included',
        reason: '讨论企业杠杆与风险，符合纳入标准。',
        evidence,
        overallSummary:
          '本条为排版测试数据，不是真实研究结论。示例文献围绕财务杠杆与企业韧性，说明债务融资的投资作用及其风险放大机制。',
        findings: [
          {
            group: 'concepts',
            dimension: '财务杠杆',
            hasContent: true,
            points: [
              { summary: '财务杠杆反映企业通过债务融资扩大投资的作用。', evidence: [evidence[0]] },
              { summary: '其风险表现与现金流波动有关。', evidence: [evidence[1]] }
            ]
          },
          {
            group: 'relations',
            dimension: '杠杆与风险',
            hasContent: true,
            points: [{ summary: '杠杆水平上升可能放大现金流波动。', evidence }]
          },
          {
            group: 'viewpoints',
            dimension: '风险放大机制',
            hasContent: true,
            points: [
              { summary: '债务融资支持投资扩张。', evidence },
              { summary: '风险解释需考虑现金流变化。', evidence: [evidence[1]] }
            ]
          }
        ]
      }
    ],
    runs: [],
    history: [],
    createdAt: 1,
    updatedAt: 2
  })
const archive = (w = reportFixture(), incomplete: string[] = []): Record<string, Uint8Array> =>
  unzipSync(
    Buffer.from(buildScreeningExport(w, false, incomplete, '模板验证项目').base64, 'base64')
  )
const documentXml = (files: Record<string, Uint8Array>, name: string): string =>
  strFromU8(unzipSync(files[name])['word/document.xml'])
const text = (xml: string): string => xml.replace(/<[^>]+>/gu, '')

describe('workflow report template export', () => {
  it('uses the original report tree and template styles with no private reference content', () => {
    const files = archive()
    expect(Object.keys(files)).toEqual([
      'screening_details.docx',
      'extraction_dimensions/concepts/财务杠杆.docx',
      'extraction_dimensions/relations/杠杆与风险.docx',
      'extraction_dimensions/viewpoints/风险放大机制.docx',
      '工作流记录.json'
    ])
    const report = unzipSync(files['screening_details.docx'])
    const xml = strFromU8(report['word/document.xml'])
    expect(xml).toContain('w:val="Title"')
    expect(xml).toContain('w:val="center"')
    expect(xml).toContain('w:w="12240" w:h="15840"')
    expect(strFromU8(report['word/styles.xml'])).toContain('Times New Roman')
    expect(report['word/numbering.xml']).toBeDefined()
    expect(strFromU8(report['word/_rels/document.xml.rels'])).toContain('numbering.xml')
    expect(Object.keys(report)).not.toContain('docProps/core.xml')
    for (const part of Object.values(report)) expect(strFromU8(part)).not.toContain('新苗财务杠杆')
  })
  it('writes screening summary and metadata, counting reviewed decisions rather than suggestions', () => {
    const w = reportFixture()
    w.documents.push({ ...w.documents[0], id: 'pending', decision: undefined })
    w.documents.push({ ...w.documents[0], id: 'excluded', decision: 'excluded' })
    w.documents.push({ ...w.documents[0], id: 'deferred', deferred: true })
    const report = text(documentXml(archive(w), 'screening_details.docx'))
    expect(report).toContain('文献初筛明细报告')
    expect(report).toContain('一、筛选汇总')
    expect(report).toContain('保留：1 篇（25.0%）')
    expect(report).toContain('排除：1 篇（25.0%）')
    expect(report).toContain('未完成：2 篇（50.0%）')
    expect(report).toContain('二、筛选明细')
    expect(report).toContain('文件名：模板测试.pdf')
    expect(report).toContain('初版时间：2025-03-01')
    expect(report).toContain('筛选原因：')
  })
  it('groups concepts into one summary and viewpoints into separately supported points', () => {
    const files = archive()
    const concept = text(documentXml(files, 'extraction_dimensions/concepts/财务杠杆.docx'))
    expect(concept).toContain('条目数：1')
    expect(concept).toContain('整篇摘要：本条为排版测试数据')
    expect(concept.match(/观点概括：/gu)).toHaveLength(1)
    expect(concept).not.toContain('观点 1：')
    for (const e of evidence) expect(concept).toContain(e.quote)
    const viewpoints = documentXml(files, 'extraction_dimensions/viewpoints/风险放大机制.docx')
    expect(text(viewpoints)).toContain('观点 1：债务融资支持投资扩张。')
    expect(text(viewpoints)).toContain('观点 2：风险解释需考虑现金流变化。')
    expect(viewpoints).toContain('w:val="ListBullet2"')
    expect(viewpoints).toContain('w:val="ListBullet3"')
    expect(text(viewpoints)).toContain('原文定位：详见：')
    expect(text(viewpoints)).toContain('PDF 页码：2')
  })
  it('keeps partial scope and missing historical fields explicit without inventing data', () => {
    const w = reportFixture()
    delete w.documents[0].overallSummary
    delete w.documents[0].initialPublicationDate
    w.documents.push({
      ...w.documents[0],
      id: 'failed',
      title: '待处理文献',
      extractionStatus: 'failed'
    })
    const report = text(
      documentXml(archive(w, ['failed']), 'extraction_dimensions/concepts/财务杠杆.docx')
    )
    expect(report).toContain('条目数：1')
    expect(report).toContain('未提取（文献年份：2025）')
    expect(report).toContain('旧版结果未保存整篇摘要')
    expect(report).toContain('部分导出：1 篇')
    expect(report).not.toContain('2. 待处理文献')
  })
  it('does not overwrite dimensions with colliding or reserved Windows filenames', () => {
    const w = reportFixture()
    w.config.concepts = ['A/B', 'A:B', 'a_b', 'CON', '../']
    expect(
      Object.keys(archive(w)).filter((name) => name.startsWith('extraction_dimensions/concepts/'))
    ).toEqual([
      'extraction_dimensions/concepts/A_B.docx',
      'extraction_dimensions/concepts/A_B (2).docx',
      'extraction_dimensions/concepts/a_b (3).docx',
      'extraction_dimensions/concepts/_CON.docx',
      'extraction_dimensions/concepts/.._.docx'
    ])
  })
  it('shortens visible evidence only and preserves the full audited source', () => {
    const w = reportFixture()
    const quote = '引文'.repeat(40)
    w.documents[0].findings[0].points[0].evidence = [{ quote, matched: false }]
    const files = archive(w)
    const report = text(documentXml(files, 'extraction_dimensions/concepts/财务杠杆.docx'))
    expect(report).toContain(`${quote.slice(0, 49)}…（定位待核对）`)
    expect(
      JSON.parse(strFromU8(files['工作流记录.json'])).documents[0].findings[0].points[0].evidence[0]
        .quote
    ).toBe(quote)
    expect(w.documents[0].findings[0].points[0].evidence[0].quote).toBe(quote)
  })
})
