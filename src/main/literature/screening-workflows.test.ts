import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { literatureItemInputSchema, type LiteratureItemView } from '../../shared/literature'
import type { ScreeningWorkflow } from '../../shared/literature-screening'
import { LiteratureScreeningWorkflows, screeningChunks } from './screening-workflows'

let root: string
let owner: LiteratureScreeningWorkflows
const quote = 'Digital transformation improves corporate financing efficiency.'
const generate = vi.fn(async () =>
  JSON.stringify({
    decision: 'included',
    reason: 'Matches the scope',
    evidence: [{ quote, page: 99 }]
  })
)
const getItem = async (id: string): Promise<LiteratureItemView> => ({
  id,
  item: literatureItemInputSchema.parse({ itemType: 'journalArticle', title: id, rating: 4 }),
  attachments: [],
  projectIds: ['project'],
  collectionIds: [],
  metadataRevision: 1,
  createdAt: 1,
  updatedAt: 1
})
const createOwner = (): LiteratureScreeningWorkflows =>
  new LiteratureScreeningWorkflows({
    root,
    getItem,
    getProjectName: async () => '实际项目',
    parse: async () => [],
    model: async () => ({ name: 'test-model', generate })
  })
const get = async (id: string): Promise<ScreeningWorkflow> =>
  (await owner.run({ action: 'get', workflowId: id })).workflow!
async function prepared(ids = ['paper-1']): Promise<ScreeningWorkflow> {
  let w = (
    await owner.run({ action: 'create', projectId: 'project', name: 'Review', itemIds: ids })
  ).workflow!
  w = (
    await owner.run({
      action: 'config',
      workflowId: w.id,
      expectedUpdatedAt: w.updatedAt,
      config: {
        ...w.config,
        topic: 'Finance',
        inclusion: 'Corporate financing',
        exclusion: 'Household finance',
        viewpoints: ['Financing efficiency']
      }
    })
  ).workflow!
  for (const itemId of ids)
    w = (
      await owner.run({
        action: 'markdown',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemId,
        filename: 'source.md',
        text: `Background\n\n${quote}`
      })
    ).workflow!
  return (
    await owner.run({
      action: 'confirm',
      workflowId: w.id,
      expectedUpdatedAt: w.updatedAt,
      stage: 'parse'
    })
  ).workflow!
}
async function execute(
  w: ScreeningWorkflow,
  stage: 'screen' | 'extract',
  sample = false
): Promise<ScreeningWorkflow> {
  await owner.run({
    action: 'run',
    workflowId: w.id,
    expectedUpdatedAt: w.updatedAt,
    stage,
    sample
  })
  await vi.waitFor(
    async () => {
      expect((await get(w.id)).runs.at(-1)?.state).not.toBe('running')
    },
    { timeout: 5000, interval: 10 }
  )
  return get(w.id)
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'screening-test-'))
  generate.mockReset().mockImplementation(async () =>
    JSON.stringify({
      decision: 'included',
      reason: 'Matches the scope',
      evidence: [{ quote, page: 99 }]
    })
  )
  owner = createOwner()
})
afterEach(async () => {
  await owner.close()
  await rm(root, { recursive: true, force: true })
})

describe('durable literature screening', () => {
  it('extracts findings despite presentation wrappers, numeric page strings and optional metadata gaps', async () => {
    let w = await execute(await prepared(), 'screen')
    w = (
      await owner.run({
        action: 'review',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemIds: ['paper-1'],
        acceptSuggestions: true
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen'
      })
    ).workflow!
    generate.mockClear().mockResolvedValue(
      '提取结果：\n```json\n' +
        JSON.stringify({
          overallSummary: '原文支持融资效率改善。',
          findings: [
            {
              group: 'viewpoints',
              dimension: 'Financing efficiency',
              hasContent: true,
              confidence: 0.9,
              points: [
                {
                  summary: 'Financing improves',
                  evidence: [{ quote, page: '99', matched: true, location: 'body' }]
                }
              ]
            }
          ],
          metadata: { authors: null, doi: null }
        }) +
        '\n```'
    )
    w = await execute(w, 'extract')
    expect(w.documents[0].extractionStatus).toBe('done')
    expect(w.documents[0].findings[0].points[0].evidence).toEqual([
      { quote, page: 2, matched: true }
    ])
    expect(w.documents[0].title).toBe('paper-1')
    expect(w.documents[0].error).toBeUndefined()
    expect(generate).toHaveBeenCalledOnce()
    await owner.close()
    owner = createOwner()
    expect((await get(w.id)).documents[0].findings).toEqual(w.documents[0].findings)
  })
  it('regenerates malformed JSON for the third paper without losing the other results', async () => {
    const valid = JSON.stringify({
      decision: 'included',
      reason: 'Within scope',
      evidence: [{ quote }]
    })
    generate
      .mockResolvedValueOnce(valid)
      .mockResolvedValueOnce(valid)
      .mockResolvedValueOnce(
        '{"decision":"included","reason":"研究"人工智能"的影响","evidence":[]}'
      )
      .mockResolvedValueOnce(valid)
      .mockResolvedValueOnce(valid)
    const w = await execute(await prepared(['one', 'two', 'three', 'four']), 'screen')
    expect(w.documents.map((d) => d.screeningStatus)).toEqual(['done', 'done', 'done', 'done'])
    expect(w.runs.at(-1)?.failedIds).toEqual([])
    expect(generate).toHaveBeenCalledTimes(5)
    expect(generate).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('valid JSON'),
      expect.any(String),
      expect.any(AbortSignal)
    )
  })
  it('bounds malformed-output retries and continues with the next paper', async () => {
    generate
      .mockResolvedValueOnce('{"reason":"broken"quote"}')
      .mockResolvedValueOnce('{"decision":"not-a-decision"}')
    const w = await execute(await prepared(['bad', 'good']), 'screen')
    expect(w.documents[0]).toMatchObject({
      screeningStatus: 'failed',
      error: 'The model returned invalid screening data. Retry this reference.'
    })
    expect(w.documents[0].decision).toBeUndefined()
    expect(w.documents[1].screeningStatus).toBe('done')
    expect(generate).toHaveBeenCalledTimes(3)
    await owner.run({
      action: 'run',
      workflowId: w.id,
      expectedUpdatedAt: w.updatedAt,
      stage: 'screen',
      retry: true
    })
    await vi.waitFor(async () => expect((await get(w.id)).runs.at(-1)?.state).toBe('completed'))
    const retried = await get(w.id)
    expect(retried.documents.every((d) => d.screeningStatus === 'done')).toBe(true)
    expect(retried.runs.at(-1)?.itemIds).toEqual(['bad'])
    expect(generate).toHaveBeenCalledTimes(4)
  })
  it('persists structured criteria, sends them to screening and invalidates results when their logic changes', async () => {
    let w = await prepared()
    const inclusionRules = {
      mode: 'all' as const,
      items: ['Corporate firms', 'Empirical evidence'],
      notes: ''
    }
    const exclusionRules = {
      mode: 'any' as const,
      items: ['Reviews', 'Duplicates'],
      notes: 'Missing full text remains uncertain.'
    }
    w = (
      await owner.run({
        action: 'config',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        config: { ...w.config, inclusionRules, exclusionRules }
      })
    ).workflow!
    expect((await get(w.id)).config.inclusionRules).toEqual(inclusionRules)
    w = await execute(w, 'screen')
    expect(generate).toHaveBeenCalledWith(
      expect.stringContaining('mode all requires every item, any requires at least one item'),
      expect.stringContaining(`"exclusionRules":${JSON.stringify(exclusionRules)}`),
      expect.any(AbortSignal)
    )
    expect(w.documents[0].screeningStatus).toBe('done')
    w = (
      await owner.run({
        action: 'config',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        config: { ...w.config, inclusionRules: { ...inclusionRules, mode: 'any' } }
      })
    ).workflow!
    expect(w.documents[0].screeningStatus).toBe('stale')
    expect(w.screeningConfirmed).toBe(false)
  })
  it('previews incomplete evidence without granting permission to download a partial export', async () => {
    let w = await prepared(['complete', 'failed'])
    w = (
      await owner.run({
        action: 'review',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemIds: ['complete', 'failed'],
        decision: 'included'
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen'
      })
    ).workflow!
    generate
      .mockResolvedValueOnce(JSON.stringify({ overallSummary: '整篇摘要', findings: [] }))
      .mockRejectedValueOnce(new Error('Provider unavailable'))
    w = await execute(w, 'extract')
    expect(w.documents[1].extractionStatus).toBe('failed')
    const request = {
      action: 'export' as const,
      workflowId: w.id,
      expectedUpdatedAt: w.updatedAt,
      screeningOnly: false,
      partial: false
    }
    const result = await owner.run({ ...request, preview: true } as Parameters<typeof owner.run>[0])
    const archive = unzipSync(Buffer.from(result.export!.base64, 'base64'))
    const record = JSON.parse(strFromU8(archive['工作流记录.json']))
    expect(record.export.incompleteIds).toEqual(['failed'])
    expect(result.export!.files).toContain('screening_details.docx')
    await expect(owner.run(request)).rejects.toThrow('partial export')
    expect(await get(w.id)).toEqual(w)
    expect((await owner.run({ ...request, partial: true })).export).toBeDefined()
  })
  it('defers unresolved references explicitly and extracts included papers without notes', async () => {
    let w = await prepared(['included', 'uncertain', 'unreviewed'])
    for (const [id, decision] of [
      ['included', 'included'],
      ['uncertain', 'uncertain']
    ] as const) {
      w = (
        await owner.run({
          action: 'review',
          workflowId: w.id,
          expectedUpdatedAt: w.updatedAt,
          itemIds: [id],
          decision,
          note: ''
        })
      ).workflow!
    }
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen',
        deferUnresolved: true
      })
    ).workflow!
    expect(w.stage).toBe(4)
    expect(w.documents.map((d) => d.deferred)).toEqual([false, true, true])
    expect(w.documents[1].decision).toBe('uncertain')
    const deferredStatus = w.documents[1].extractionStatus
    generate.mockResolvedValue(
      JSON.stringify({
        overallSummary: '整篇摘要',
        findings: [
          {
            group: 'viewpoints',
            dimension: 'Financing efficiency',
            hasContent: true,
            points: [{ summary: 'Financing improves', evidence: [{ quote, page: 2 }] }]
          }
        ]
      })
    )
    w = await execute(w, 'extract')
    expect(w.runs.at(-1)?.itemIds).toEqual(['included'])
    expect(w.documents[0].extractionStatus).toBe('done')
    expect(w.documents[0].note).toBe('')
    expect(w.documents[1].extractionStatus).toBe(deferredStatus)
    await owner.close()
    owner = createOwner()
    w = await get(w.id)
    expect(w.documents[1].deferred).toBe(true)
    w = (
      await owner.run({
        action: 'review',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemIds: ['uncertain'],
        decision: 'included',
        deferred: false
      })
    ).workflow!
    expect(w.screeningConfirmed).toBe(false)
    expect(w.documents[1].deferred).toBe(false)
  })
  it('does not defer everything or save changes when no decision has been made', async () => {
    const w = await prepared()
    await expect(
      owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen',
        deferUnresolved: true
      })
    ).rejects.toThrow('at least one reference')
    expect(await get(w.id)).toEqual(w)
  })
  it('uses a persisted default dimension when all extraction dimensions are blank', async () => {
    let w = await prepared()
    w = (
      await owner.run({
        action: 'config',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        config: { ...w.config, viewpoints: [] }
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'review',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemIds: ['paper-1'],
        decision: 'included'
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen'
      })
    ).workflow!
    generate.mockResolvedValue(
      JSON.stringify({
        overallSummary: '整篇摘要',
        findings: [
          {
            group: 'viewpoints',
            dimension: '主要研究观点',
            hasContent: true,
            points: [{ summary: 'General finding', evidence: [{ quote, page: 2 }] }]
          }
        ]
      })
    )
    w = await execute(w, 'extract')
    expect(w.config.viewpoints).toEqual(['主要研究观点'])
    expect(w.documents[0].findings[0].points[0].summary).toBe('General finding')
    expect(w.documents[0].extractionStatus).toBe('done')
  })
  it('requires explicit stage confirmation and keeps AI suggestions separate from manual decisions', async () => {
    let w = await prepared()
    await expect(
      owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen'
      })
    ).rejects.toThrow('inclusion decision')
    w = await execute(w, 'screen')
    expect(w.documents[0]).toMatchObject({
      suggestion: 'included',
      screeningStatus: 'done',
      evidence: [{ quote, page: 2, matched: true }]
    })
    expect(w.documents[0].decision).toBeUndefined()
    expect(w.stage).toBe(3)
    w = (
      await owner.run({
        action: 'review',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemIds: ['paper-1'],
        decision: 'included',
        note: 'Checked original text'
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen'
      })
    ).workflow!
    expect(w.stage).toBe(4)
    expect((await getItem('paper-1')).item.rating).toBe(4)
    const other = (
      await owner.run({
        action: 'create',
        projectId: 'project',
        name: 'Independent review',
        itemIds: ['paper-1']
      })
    ).workflow!
    expect(other.documents[0].decision).toBeUndefined()
    expect((await owner.run({ action: 'list', projectId: 'another-project' })).workflows).toEqual(
      []
    )
  })
  it('never excludes on ungrounded evidence and isolates model failures per paper', async () => {
    generate
      .mockImplementationOnce(async () =>
        JSON.stringify({
          decision: 'excluded',
          reason: 'No evidence',
          evidence: [{ quote: 'Invented quote', page: 1 }]
        })
      )
      .mockRejectedValueOnce(new Error('Provider timeout'))
    const w = await execute(await prepared(['paper-1', 'paper-2']), 'screen')
    expect(w.documents[0]).toMatchObject({
      suggestion: 'uncertain',
      evidence: [{ quote: 'Invented quote', matched: false }]
    })
    expect(w.documents[1]).toMatchObject({ screeningStatus: 'failed', error: 'Provider timeout' })
    expect(w.documents[1].decision).toBeUndefined()
    expect(w.runs.at(-1)?.state).toBe('failed')
  })
  it('keeps sample extraction separate, exports real DOCX files and invalidates changed rules', async () => {
    let w = await execute(await prepared(), 'screen')
    w = (
      await owner.run({
        action: 'review',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemIds: ['paper-1'],
        acceptSuggestions: true
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen'
      })
    ).workflow!
    generate.mockImplementation(async () =>
      JSON.stringify({
        overallSummary: '整篇摘要',
        findings: [
          {
            group: 'viewpoints',
            dimension: 'Financing efficiency',
            hasContent: true,
            points: [
              { summary: 'Lower financing friction', evidence: [{ quote, page: 99 }] },
              { summary: 'Improved efficiency', evidence: [{ quote }] }
            ]
          }
        ]
      })
    )
    w = await execute(w, 'extract', true)
    expect(w.documents[0].sampleFindings?.[0].points).toHaveLength(2)
    expect(w.documents[0].sampleOverallSummary).toBe('整篇摘要')
    expect(w.documents[0].overallSummary).toBeUndefined()
    expect(w.documents[0].findings).toEqual([])
    expect(w.documents[0].extractionStatus).not.toBe('done')
    await expect(
      owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'extract'
      })
    ).rejects.toThrow('Finish extraction')
    w = await execute(w, 'extract')
    expect(w.documents[0].overallSummary).toBe('整篇摘要')
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'extract'
      })
    ).workflow!
    const result = (
      await owner.run({
        action: 'export',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        partial: false,
        screeningOnly: false
      })
    ).export!
    const zip = unzipSync(Buffer.from(result.base64, 'base64'))
    expect(result.filename).toBe('实际项目证据包.zip')
    expect(Object.keys(zip)).toContain('screening_details.docx')
    const report = Object.keys(zip).find((name) =>
      name.startsWith('extraction_dimensions/viewpoints/')
    )!
    const docx = unzipSync(zip[report])
    const xml = strFromU8(docx['word/document.xml'])
    expect(xml).toContain('Lower financing friction')
    expect(xml).toContain(quote.slice(0, 49))
    expect(xml).toContain('文本段落：2')
    expect(JSON.parse(strFromU8(zip['工作流记录.json'])).documents[0].decision).toBe('included')
    const staleTime = w.updatedAt
    w = (
      await owner.run({
        action: 'config',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        config: { ...w.config, topic: 'Changed scope' }
      })
    ).workflow!
    expect(w.documents[0]).toMatchObject({ screeningStatus: 'stale', extractionStatus: 'stale' })
    expect(w.documents[0].decision).toBeUndefined()
    expect(w.screeningConfirmed).toBe(false)
    expect(w.history.some((h) => h.action === 'invalidate')).toBe(true)
    await expect(
      owner.run({
        action: 'config',
        workflowId: w.id,
        expectedUpdatedAt: staleTime,
        config: w.config
      })
    ).rejects.toThrow('changed')
  })
  it('pauses safely and resumes pending work after restart', async () => {
    let w = await prepared()
    generate.mockImplementation(
      (_system?: string, _prompt?: string, signal?: AbortSignal) =>
        new Promise((_resolve, reject) =>
          signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        )
    )
    await owner.run({
      action: 'run',
      workflowId: w.id,
      expectedUpdatedAt: w.updatedAt,
      stage: 'screen'
    })
    await vi.waitFor(() => expect(generate).toHaveBeenCalled())
    await owner.close()
    owner = createOwner()
    w = await get(w.id)
    expect(w.runs.at(-1)?.state).toBe('paused')
    expect(w.documents[0].screeningStatus).toBe('pending')
    const file = join(root, `${w.id}.json`)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    saved.runs.at(-1).state = 'running'
    saved.documents[0].screeningStatus = 'running'
    await writeFile(file, JSON.stringify(saved))
    w = await get(w.id)
    expect(w.runs.at(-1)?.state).toBe('paused')
    expect(w.documents[0].screeningStatus).toBe('pending')
  })
  it('backfills old report summaries without replacing reviewed findings, including after a failed attempt', async () => {
    let w = await prepared()
    const findings = [
      {
        group: 'viewpoints' as const,
        dimension: 'Financing efficiency',
        hasContent: true,
        points: [
          { summary: 'Human-reviewed finding', evidence: [{ quote, page: 2, matched: true }] }
        ]
      }
    ]
    w.screeningConfirmed = true
    w.extractionConfirmed = true
    Object.assign(w.documents[0], {
      decision: 'included',
      extractionStatus: 'done',
      findings,
      originalFindings: findings,
      editedAt: 123
    })
    await writeFile(join(root, `${w.id}.json`), JSON.stringify(w))
    generate.mockRejectedValueOnce(new Error('Provider unavailable'))
    w = await execute(w, 'extract')
    expect(w.documents[0].extractionStatus).toBe('done')
    expect(w.documents[0].findings).toEqual(findings)
    generate.mockResolvedValue(
      JSON.stringify({
        overallSummary: '补全的整篇摘要',
        findings: [],
        metadata: { title: '', authors: ['Author'], doi: '', initialPublicationDate: '2025-01-03' }
      })
    )
    w = await execute(w, 'extract')
    expect(w.documents[0]).toMatchObject({
      overallSummary: '补全的整篇摘要',
      findings,
      originalFindings: findings,
      editedAt: 123,
      initialPublicationDate: '2025-01-03',
      authors: 'Author'
    })
    expect(w.extractionConfirmed).toBe(false)
    const saved = await get(w.id)
    expect(saved.documents[0].overallSummary).toBe('补全的整篇摘要')
  })
  it('synthesizes all chunks into a whole-paper summary and preserves distinct evidence for repeated findings', async () => {
    let w = await prepared()
    const secondQuote = 'Firm resilience also depends on cash flow stability.'
    w = (
      await owner.run({
        action: 'markdown',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemId: 'paper-1',
        filename: 'long.md',
        text: `${quote}${' A'.repeat(7000)}\n\n${secondQuote}${' B'.repeat(7000)}`
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'parse'
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'review',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        itemIds: ['paper-1'],
        decision: 'included'
      })
    ).workflow!
    w = (
      await owner.run({
        action: 'confirm',
        workflowId: w.id,
        expectedUpdatedAt: w.updatedAt,
        stage: 'screen'
      })
    ).workflow!
    generate.mockImplementation(async (_system?: string, prompt?: string) => {
      const input = JSON.parse(prompt!)
      if (input.summaries) {
        expect(input.summaries).toEqual(['片段 1 摘要', '片段 2 摘要'])
        return JSON.stringify({ overallSummary: '整篇综合摘要' })
      }
      const page = input.pages[0].page
      return JSON.stringify({
        overallSummary: `片段 ${page} 摘要`,
        findings: [
          {
            group: 'viewpoints',
            dimension: 'Financing efficiency',
            hasContent: true,
            points: [
              {
                summary: 'Same finding',
                evidence: [{ quote: page === 1 ? quote : secondQuote, page }]
              }
            ]
          }
        ]
      })
    })
    w = await execute(w, 'extract')
    expect(w.documents[0].overallSummary).toBe('整篇综合摘要')
    expect(w.documents[0].findings[0].points).toHaveLength(1)
    expect(w.documents[0].findings[0].points[0].evidence).toEqual([
      { quote, page: 1, matched: true },
      { quote: secondQuote, page: 2, matched: true }
    ])
    expect(generate).toHaveBeenCalledTimes(3)
  })
  it('covers the end of long papers rather than truncating at a document limit', () => {
    const text = 'A'.repeat(70000) + 'TAIL_EVIDENCE'
    const chunks = screeningChunks([{ page: 1, text }])
    expect(chunks.length).toBeGreaterThan(3)
    expect(chunks.at(-1)?.[0].text).toContain('TAIL_EVIDENCE')
    expect(chunks.flat().every((p) => p.text.length <= 18000)).toBe(true)
  })
})
