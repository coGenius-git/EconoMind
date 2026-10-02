import { z } from 'zod'

import { defineApplicationCommandContract, validationCodec } from './application-command-contract'
import { projectSessionDefaultsSchema } from './session-configuration'

// Shared project types crossing the main <-> renderer IPC boundary.
//
// The SQLite/Prisma layer owns Project rows (see src/main/projects). Timestamps are normalized to
// epoch milliseconds at the repository boundary so the renderer treats them like session timestamps.

export const PROJECT_NAME_MAX_LENGTH = 200
export const PROJECT_DESCRIPTION_MAX_LENGTH = 1000

// EconoMind research-domain categories. "general" is the fallback for projects created before the
// domain-tuned project types shipped.
export const PROJECT_CATEGORIES = [
  'general',
  'economics',
  'management',
  'finance',
  'accounting',
  'case_study'
] as const
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

// Default Agent Context seeded when a project is created without one, by research domain. The
// template describes the recommended file skeleton (research_question.md, literature/, dataset/,
// analysis/, output/) and research flow so both the agent and the user share a working structure.
// Kept deliberately short: the context is injected verbatim into every agent session.
export const PROJECT_CATEGORY_AGENT_CONTEXT: Record<ProjectCategory, string> = {
  general: '',
  economics: `Economic research project. Suggested file skeleton:
- research_question.md — research question, motivation, expected contribution
- literature/ — reading notes and screening records
- dataset/ — data files and data dictionary
- analysis/ — econometric analysis and robustness checks
- output/ — figures, tables, and the final report
Typical flow: question -> literature review -> research design (variables/model) -> data -> empirical analysis -> report.`,
  management: `Management research project. Suggested file skeleton:
- research_question.md — research question, motivation, expected contribution
- literature/ — reading notes and screening records
- dataset/ — survey/case/panel data and codebook
- analysis/ — empirical analysis (regressions, mediation/moderation) and robustness checks
- output/ — figures, tables, and the final report
Typical flow: question -> literature review -> conceptual framework (X/Y/mediator/moderator) -> data -> analysis -> report.`,
  finance: `Finance research project. Suggested file skeleton:
- research_question.md — research question, motivation, expected contribution
- literature/ — reading notes and screening records
- dataset/ — market/firm-level data and variable definitions
- analysis/ — asset pricing / event study / panel analysis and robustness checks
- output/ — figures, tables, and the final report
Typical flow: question -> literature review -> hypothesis -> data -> empirical analysis -> report.`,
  accounting: `Accounting research project. Suggested file skeleton:
- research_question.md — research question, motivation, expected contribution
- literature/ — reading notes and screening records
- dataset/ — financial statement data and variable definitions
- analysis/ — empirical analysis and robustness checks
- output/ — figures, tables, and the final report
Typical flow: question -> literature review -> hypothesis -> data -> empirical analysis -> report.`,
  case_study: `Case study research project. Suggested file skeleton:
- research_question.md — research question, motivation, expected contribution
- literature/ — reading notes and screening records
- dataset/ — interview/archival evidence and case chronology
- analysis/ — within-case and cross-case analysis
- output/ — figures, tables, and the final report
Typical flow: question -> literature review -> case selection -> evidence collection -> analysis -> report.`
}

export const projectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    // Optional on the wire for compatibility with older persisted payloads; absence means no
    // Agent Context. The DB column is NOT NULL DEFAULT ''. Capped because it is injected verbatim
    // into every agent session's system prompt.
    agentContext: z.string().max(16000).optional(),
    sessionDefaults: projectSessionDefaultsSchema.optional(),
    isExample: z.boolean(),
    // EconoMind research-domain category; absent on older payloads means "general".
    category: z.enum(PROJECT_CATEGORIES).optional(),
    // Optional on the wire for compatibility with older persisted payloads; absence means unpinned.
    pinned: z.boolean().optional(),
    // An absent timestamp keeps the Project on active surfaces. Archive is reversible and does not
    // affect the Project's research activity ordering.
    archivedAt: z.number().finite().optional(),
    // Missing only in older snapshots; current database reads always include this generation.
    archiveRevision: z.number().int().nonnegative().optional(),
    createdAt: z.number().finite(),
    updatedAt: z.number().finite()
  })
  .strict()

export const createProjectRequestSchema = z
  .object({
    name: z.string().max(PROJECT_NAME_MAX_LENGTH),
    description: z.string().max(PROJECT_DESCRIPTION_MAX_LENGTH).optional(),
    agentContext: z.string().max(16000).optional(),
    category: z.enum(PROJECT_CATEGORIES).optional()
  })
  .strict()

export const updateProjectRequestSchema = z
  .object({
    id: z.string(),
    name: z.string().max(PROJECT_NAME_MAX_LENGTH).optional(),
    description: z.string().max(PROJECT_DESCRIPTION_MAX_LENGTH).optional(),
    expectedUpdatedAt: z.number().int().positive(),
    agentContext: z.string().max(16000).optional(),
    sessionDefaults: projectSessionDefaultsSchema.optional(),
    pinned: z.boolean().optional(),
    category: z.enum(PROJECT_CATEGORIES).optional()
  })
  .strict()

export const deleteProjectRequestSchema = z.object({ id: z.string() }).strict()

export const projectDeletionOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('deleted') }).strict(),
  z.object({ status: z.literal('cleanup-pending') }).strict()
])

export const projectDeletionCleanupSchema = z
  .object({
    projectId: z.string(),
    projectName: z.string().max(PROJECT_NAME_MAX_LENGTH).optional(),
    phase: z.enum(['running', 'retry-scheduled']),
    failureCount: z.number().int().nonnegative(),
    nextRetryAt: z.number().finite().optional()
  })
  .strict()

export const updateProjectArchiveRequestSchema = z
  .object({
    id: z.string(),
    archived: z.boolean(),
    // The last authoritative archive value prevents a stale renderer from restoring or archiving a
    // Project after another window has already changed it.
    expectedArchiveRevision: z.number().int().nonnegative()
  })
  .strict()

export type Project = z.infer<typeof projectSchema>
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>
export type DeleteProjectRequest = z.infer<typeof deleteProjectRequestSchema>
export type ProjectDeletionOutcome = z.infer<typeof projectDeletionOutcomeSchema>
export type ProjectDeletionCleanup = z.infer<typeof projectDeletionCleanupSchema>
export type UpdateProjectArchiveRequest = z.infer<typeof updateProjectArchiveRequestSchema>

export const projectApplicationCommandContracts = Object.freeze({
  list: defineApplicationCommandContract(
    validationCodec(z.tuple([])),
    validationCodec(z.array(projectSchema))
  ),
  get: defineApplicationCommandContract(
    validationCodec(z.tuple([z.string()])),
    validationCodec(projectSchema.nullable())
  ),
  create: defineApplicationCommandContract(
    validationCodec(z.tuple([createProjectRequestSchema])),
    validationCodec(projectSchema)
  ),
  update: defineApplicationCommandContract(
    validationCodec(z.tuple([updateProjectRequestSchema])),
    validationCodec(projectSchema)
  ),
  updateArchive: defineApplicationCommandContract(
    validationCodec(z.tuple([updateProjectArchiveRequestSchema])),
    validationCodec(projectSchema)
  ),
  delete: defineApplicationCommandContract(
    validationCodec(z.tuple([deleteProjectRequestSchema])),
    validationCodec(projectDeletionOutcomeSchema)
  ),
  listDeletionCleanup: defineApplicationCommandContract(
    validationCodec(z.tuple([])),
    validationCodec(z.array(projectDeletionCleanupSchema))
  ),
  retryDeletionCleanup: defineApplicationCommandContract(
    validationCodec(z.tuple([])),
    validationCodec(z.undefined())
  )
})
