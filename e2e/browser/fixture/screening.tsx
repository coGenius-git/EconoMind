import '@/assets/main.css'
import { createRoot } from 'react-dom/client'
import { initI18n } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LiteratureScreeningWizard } from '@/pages/literature/LiteratureScreeningWizard'
import { ResearchWorkbenchHeader } from '@/components/ResearchWorkbenchHeader'
import {
  screeningWorkflowSchema,
  type ScreeningRequest
} from '../../../src/shared/literature-screening'
import { literatureItemInputSchema } from '../../../src/shared/literature'

// Only the API boundary is substituted. The workflow components and PDF.js reader are production code.
const evidence = 'Digital transformation improves corporate financing efficiency.'
const content = [
  'LITERATURE SCREENING - UI TEST DOCUMENT',
  'Corporate financing and digital transformation',
  evidence,
  'This document is synthetic and must not be cited as research.',
  'Its only purpose is to verify PDF display and evidence navigation.'
]
const stream = `BT /F1 14 Tf 48 750 Td ${content.map((line, i) => `${i ? '0 -32 Td ' : ''}(${line}) Tj`).join('\n')} ET`
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'
]
let pdf = '%PDF-1.4\n'
const offsets = [0]
for (const [i, body] of objects.entries()) {
  offsets.push(pdf.length)
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
}
const xref = pdf.length
pdf += `xref\n0 7\n0000000000 65535 f \n${offsets
  .slice(1)
  .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
  .join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
const bytes = new TextEncoder().encode(pdf)
const stage = Number(new URLSearchParams(location.search).get('stage') ?? '3')
let workflow = screeningWorkflowSchema.parse({
  schemaVersion: 1,
  id: '2e56cce8-d0bd-43fb-9db9-7dcebf2c4b89',
  projectId: 'screening-fixture',
  config: {
    name: '数字化转型与企业融资约束',
    topic: '数字化转型如何影响企业融资约束？梳理信息披露、信息不对称与融资效率的作用机制。',
    inclusion: '以企业为研究对象；涉及数字化转型与融资约束；包含可核对的理论分析或实证结果。',
    exclusion: '仅研究居民金融行为；未涉及企业融资；缺少与主题相关的研究内容。',
    concepts: ['数字化转型', '融资约束'],
    relations: ['数字化转型与融资约束的关系'],
    viewpoints: ['信息不对称机制', '企业异质性']
  },
  revision: 1,
  stage,
  parseConfirmed: stage >= 3,
  screeningConfirmed: stage >= 4,
  extractionConfirmed: stage >= 5,
  documents: [
    '数字化转型与企业融资效率研究（界面测试）',
    '企业信息披露与融资约束（界面测试）',
    '金融科技与企业资本配置（界面测试）'
  ].map((title, i) => ({
    id: `paper-${i}`,
    title,
    authors: '测试作者',
    year: 2024 - i,
    doi: '',
    attachmentVersionId: 'fixture-pdf',
    filename: 'screening-test.pdf',
    parseStatus: 'done',
    screeningStatus: 'done',
    extractionStatus: stage >= 4 ? 'done' : 'pending',
    decision: stage >= 4 ? 'included' : undefined,
    suggestion: i === 2 ? 'uncertain' : 'included',
    reason:
      '研究对象为企业，原文明确讨论数字化转型对融资效率的影响，与纳入标准一致。请结合 PDF 完成人工确认。',
    evidence: [{ quote: evidence, page: 1, matched: true }],
    pageCount: 2,
    parsedPages: 2,
    findings:
      stage >= 4
        ? [
            {
              group: 'viewpoints',
              dimension: '信息不对称机制',
              hasContent: true,
              points: [
                {
                  summary:
                    '数字化转型改善企业融资效率，可能通过缓解信息不对称发挥作用。此条为界面测试内容。',
                  evidence: [{ quote: evidence, page: 1, matched: true }]
                }
              ]
            }
          ]
        : []
  })),
  runs: [],
  history: [],
  createdAt: 1,
  updatedAt: 1
})
if (new URLSearchParams(location.search).has('incomplete')) {
  workflow.extractionConfirmed = false
  workflow.documents[1].extractionStatus = 'failed'
  workflow.documents[1].findings = []
}
window.api = {
  saveBlobFile: async () => {
    document.documentElement.dataset.exportSaved = 'true'
    return { saved: true }
  },
  platform: 'win32',
  previewResources: {
    acquire: async () => ({
      id: 'fixture-pdf',
      url: '',
      size: bytes.length,
      mimeType: 'application/pdf',
      version: 1
    }),
    readRange: async ({ begin, end }: { begin: number; end: number }) => ({
      begin,
      end,
      total: bytes.length,
      data: bytes.slice(begin, end)
    }),
    release: async () => undefined
  },
  literature: {
    search: async () => ({
      entries: workflow.documents.map((d) => ({
        id: d.id,
        item: literatureItemInputSchema.parse({ itemType: 'journalArticle', title: d.title }),
        attachments: [],
        projectIds: ['screening-fixture'],
        collectionIds: [],
        createdAt: 1,
        updatedAt: 1,
        metadataRevision: 1
      }))
    }),
    screening: async (r: ScreeningRequest) => {
      if (r.action === 'export')
        return {
          export: await (
            await fetch('/screening-export', {
              method: 'POST',
              body: JSON.stringify({
                workflow,
                screeningOnly: r.screeningOnly,
                preview: r.preview,
                partial: r.partial
              })
            })
          ).json()
        }
      if (r.action === 'list')
        return { workflows: [{ ...workflow, total: workflow.documents.length }] }
      if (r.action === 'document')
        return {
          pages: [
            { page: 1, text: content.join('\n') },
            { page: 2, text: content.join('\n') }
          ]
        }
      if (r.action === 'review')
        for (const d of workflow.documents.filter((d) => r.itemIds.includes(d.id))) {
          if (r.decision) d.decision = r.decision
          if (r.note !== undefined) d.note = r.note
          if (r.deferred !== undefined) d.deferred = r.deferred
        }
      if (r.action === 'config') {
        workflow.config = r.config
        workflow.stage = 2
      }
      if (r.action === 'confirm') {
        if (r.stage === 'parse') {
          workflow.parseConfirmed = true
          workflow.stage = 3
        } else if (r.stage === 'screen') {
          if (r.deferUnresolved)
            for (const d of workflow.documents) {
              if (!d.decision || d.decision === 'uncertain') d.deferred = true
            }
          if (
            workflow.documents.some(
              (d) => !d.deferred && (!d.decision || d.decision === 'uncertain')
            )
          )
            throw Error('请先逐篇确认')
          workflow.screeningConfirmed = true
          workflow.stage = 4
        } else {
          workflow.extractionConfirmed = true
          workflow.stage = 5
        }
      }
      workflow = { ...workflow, updatedAt: workflow.updatedAt + 1 }
      return { workflow: structuredClone(workflow) }
    }
  }
} as unknown as typeof window.api
initI18n('zh-Hans')
createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <main className="flex h-svh flex-col overflow-hidden">
      <ResearchWorkbenchHeader
        active="library"
        onHome={() => undefined}
        onLibrary={() => undefined}
        onAnalysis={() => undefined}
        onSettings={() => undefined}
      />
      <LiteratureScreeningWizard
        open
        onClose={() => undefined}
        reviewProjectId="screening-fixture"
        scope={{ projectId: 'screening-fixture', scopeName: '经管研究 · 界面验证数据' }}
      />
    </main>
  </TooltipProvider>
)
