import { z } from 'zod'
import { defineApplicationCommandContract, validationCodec } from './application-command-contract'

const id = z.string().trim().min(1).max(512)
export function screeningEvidenceFilename(projectName: string): string {
  const name =
    projectName
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_')
      .trim()
      .slice(0, 100)
      .replace(/[. ]+$/u, '') || '未命名项目'
  return `${name}证据包.zip`
}
const screeningCriteriaSchema = z
  .object({
    mode: z.enum(['all', 'any', 'custom']),
    items: z.array(z.string().trim().min(1).max(10000)).min(1).max(50),
    notes: z.string().max(10000)
  })
  .strict()
export const screeningConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    topic: z.string().max(10000),
    inclusion: z.string().max(10000),
    exclusion: z.string().max(10000),
    inclusionRules: screeningCriteriaSchema.optional(),
    exclusionRules: screeningCriteriaSchema.optional(),
    concepts: z.array(z.string().trim().min(1).max(300)).max(50),
    relations: z.array(z.string().trim().min(1).max(300)).max(50),
    viewpoints: z.array(z.string().trim().min(1).max(300)).max(50)
  })
  .strict()
export const screeningEvidenceSchema = z
  .object({
    quote: z.string().max(2000),
    page: z.number().int().positive().optional(),
    matched: z.boolean().default(false)
  })
  .strict()
export const screeningFindingSchema = z
  .object({
    group: z.enum(['concepts', 'relations', 'viewpoints']),
    dimension: z.string().max(300),
    hasContent: z.boolean(),
    points: z
      .array(
        z
          .object({
            summary: z.string().max(10000),
            evidence: z.array(screeningEvidenceSchema).max(30)
          })
          .strict()
      )
      .max(50)
  })
  .strict()
export const screeningDecisionSchema = z.enum(['included', 'excluded', 'uncertain'])
const taskStatus = z.enum(['pending', 'running', 'done', 'failed', 'stale'])
export const screeningDocumentSchema = z
  .object({
    id,
    title: z.string(),
    authors: z.string(),
    year: z.number().nullable(),
    doi: z.string(),
    initialPublicationDate: z.string().max(200).optional(),
    overallSummary: z.string().max(10000).optional(),
    sampleOverallSummary: z.string().max(10000).optional(),
    attachmentVersionId: id.optional(),
    filename: z.string().optional(),
    checksum: z.string().optional(),
    parseStatus: taskStatus,
    pageCount: z.number().int().nonnegative().default(0),
    parsedPages: z.number().int().nonnegative().default(0),
    sourceKind: z.enum(['pdf', 'markdown']).default('pdf'),
    screeningStatus: taskStatus,
    extractionStatus: taskStatus,
    suggestion: screeningDecisionSchema.optional(),
    reason: z.string().default(''),
    evidence: z.array(screeningEvidenceSchema).default([]),
    decision: screeningDecisionSchema.optional(),
    note: z.string().default(''),
    deferred: z.boolean().default(false),
    findings: z.array(screeningFindingSchema).default([]),
    originalFindings: z.array(screeningFindingSchema).optional(),
    sampleFindings: z.array(screeningFindingSchema).optional(),
    error: z.string().optional(),
    revision: z.number().int().nonnegative().default(0),
    reviewedAt: z.number().optional(),
    editedAt: z.number().optional()
  })
  .strict()
export const screeningRunSchema = z
  .object({
    id: z.string().uuid(),
    stage: z.enum(['parse', 'screen', 'extract']),
    sample: z.boolean(),
    revision: z.number(),
    state: z.enum(['running', 'paused', 'completed', 'failed']),
    itemIds: z.array(id),
    completedIds: z.array(id),
    failedIds: z.array(id),
    startedAt: z.number(),
    finishedAt: z.number().optional(),
    model: z.string().optional(),
    error: z.string().optional()
  })
  .strict()
export const screeningWorkflowSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    projectId: id,
    config: screeningConfigSchema,
    revision: z.number().int().nonnegative(),
    stage: z.number().int().min(1).max(5),
    parseConfirmed: z.boolean(),
    screeningConfirmed: z.boolean(),
    extractionConfirmed: z.boolean(),
    documents: z.array(screeningDocumentSchema).max(1000),
    runs: z.array(screeningRunSchema),
    history: z.array(
      z.object({ at: z.number(), action: z.string(), itemId: id.optional(), detail: z.string() })
    ),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .strict()
export const screeningTextPageSchema = z
  .object({ page: z.number().int().positive(), text: z.string() })
  .strict()
export const screeningRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('refreshSource'),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      itemId: id
    })
    .strict(),
  z.object({ action: z.literal('list'), projectId: id }).strict(),
  z
    .object({
      action: z.literal('create'),
      projectId: id,
      name: z.string().trim().min(1).max(200),
      itemIds: z.array(id).min(1).max(1000)
    })
    .strict(),
  z.object({ action: z.literal('get'), workflowId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('document'), workflowId: z.string().uuid(), itemId: id }).strict(),
  z
    .object({
      action: z.literal('config'),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      config: screeningConfigSchema
    })
    .strict(),
  z
    .object({
      action: z.literal('add'),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      itemIds: z.array(id).min(1).max(1000)
    })
    .strict(),
  z
    .object({
      action: z.literal('markdown'),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      itemId: id,
      filename: z.string().max(300),
      text: z.string().min(1).max(5000000)
    })
    .strict(),
  z
    .object({
      action: z.literal('run'),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      stage: z.enum(['parse', 'screen', 'extract']),
      sample: z.boolean().default(false),
      retry: z.boolean().default(false)
    })
    .strict(),
  z.object({ action: z.literal('pause'), workflowId: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal('confirm'),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      stage: z.enum(['parse', 'screen', 'extract']),
      deferUnresolved: z.boolean().default(false)
    })
    .strict(),
  z
    .object({
      action: z.literal('review'),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      itemIds: z.array(id).min(1).max(1000),
      decision: screeningDecisionSchema.optional(),
      acceptSuggestions: z.boolean().optional(),
      note: z.string().max(10000).optional(),
      deferred: z.boolean().optional()
    })
    .strict(),
  z
    .object({
      action: z.literal('findings'),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      itemId: id,
      findings: z.array(screeningFindingSchema).max(150)
    })
    .strict(),
  z
    .object({
      action: z.literal('export'),
      preview: z.boolean().default(false),
      workflowId: z.string().uuid(),
      expectedUpdatedAt: z.number(),
      partial: z.boolean(),
      screeningOnly: z.boolean()
    })
    .strict()
])
export const screeningResponseSchema = z
  .object({
    workflows: z
      .array(
        screeningWorkflowSchema
          .omit({ documents: true, history: true, runs: true })
          .extend({ total: z.number() })
      )
      .optional(),
    workflow: screeningWorkflowSchema.optional(),
    pages: z.array(screeningTextPageSchema).optional(),
    export: z
      .object({ filename: z.string(), base64: z.string(), files: z.array(z.string()) })
      .optional()
  })
  .strict()
export const literatureScreeningContract = defineApplicationCommandContract(
  validationCodec(z.tuple([screeningRequestSchema])),
  validationCodec(screeningResponseSchema)
)
export type ScreeningConfig = z.infer<typeof screeningConfigSchema>
export type ScreeningCriteria = z.infer<typeof screeningCriteriaSchema>
export function normalizeCriteria(value: ScreeningCriteria): ScreeningCriteria {
  return {
    ...value,
    items: value.items.map((item) => item.trim()).filter(Boolean),
    notes: value.notes.trim()
  }
}
export type ScreeningDocument = z.infer<typeof screeningDocumentSchema>
export type ScreeningFinding = z.infer<typeof screeningFindingSchema>
export type ScreeningWorkflow = z.infer<typeof screeningWorkflowSchema>
export type ScreeningRun = z.infer<typeof screeningRunSchema>
export type ScreeningTextPage = z.infer<typeof screeningTextPageSchema>
export type ScreeningRequest = z.input<typeof screeningRequestSchema>
export type ScreeningResponse = z.infer<typeof screeningResponseSchema>
