import { z } from 'zod'
import { defineApplicationCommandContract, validationCodec } from './application-command-contract'

// Literature discovery: search external sources by topic and criteria, review the returned
// candidate list, then import the selected records into the library for title/abstract screening.
// This module only describes the wire contract; providers live in src/main/literature/discovery.

// Both sources can be searched online; CNKI additionally supports exported reference files.
export const DISCOVERY_SOURCE_IDS = ['openalex', 'cnki'] as const
export const DISCOVERY_SEARCH_SOURCE_IDS = ['openalex', 'cnki'] as const
export const DISCOVERY_DOCUMENT_TYPES = [
  'article',
  'review',
  'dissertation',
  'conference',
  'book',
  'other'
] as const
// Tiers are advisory. A provider reports the tiers it can actually resolve and the service
// records unresolved tiers as warnings instead of silently widening the result set.
export const DISCOVERY_SOURCE_TIERS = [
  'cssci',
  'pkucore',
  'sci',
  'ssci',
  'ei',
  'doaj',
  'open-access'
] as const

export const DISCOVERY_RESULT_LIMIT = 200
export const DISCOVERY_DEFAULT_LIMIT = 50

const boundedText = (max: number): z.ZodString => z.string().trim().max(max)

const discoverySourceIdSchema = z.enum(DISCOVERY_SOURCE_IDS)
const discoveryDocumentTypeSchema = z.enum(DISCOVERY_DOCUMENT_TYPES)
const discoverySourceTierSchema = z.enum(DISCOVERY_SOURCE_TIERS)

export const discoveryQuerySchema = z
  .object({
    topic: z.string().trim().min(1).max(1000),
    keywords: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    yearFrom: z.number().int().min(1000).max(9999).nullable().default(null),
    yearTo: z.number().int().min(1000).max(9999).nullable().default(null),
    documentTypes: z
      .array(discoveryDocumentTypeSchema)
      .max(DISCOVERY_DOCUMENT_TYPES.length)
      .default([]),
    sourceTiers: z.array(discoverySourceTierSchema).max(DISCOVERY_SOURCE_TIERS.length).default([]),
    minCitations: z.number().int().min(0).max(10_000_000).nullable().default(null),
    limit: z.number().int().min(1).max(DISCOVERY_RESULT_LIMIT).default(DISCOVERY_DEFAULT_LIMIT),
    sources: z
      .array(discoverySourceIdSchema)
      .min(1)
      .max(DISCOVERY_SOURCE_IDS.length)
      .default(['openalex'])
  })
  .strict()

export const discoveryCandidateSchema = z
  .object({
    key: z.string().trim().min(1).max(512),
    source: discoverySourceIdSchema,
    externalId: boundedText(512).default(''),
    title: boundedText(2000),
    authors: z.array(boundedText(300)).max(100).default([]),
    year: z.number().int().min(0).max(9999).nullable().default(null),
    venue: boundedText(1000).default(''),
    documentType: discoveryDocumentTypeSchema.default('other'),
    doi: boundedText(300).default(''),
    url: boundedText(2000).default(''),
    abstract: boundedText(20_000).default(''),
    citationCount: z.number().int().min(0).max(100_000_000).nullable().default(null),
    sourceTiers: z.array(discoverySourceTierSchema).max(DISCOVERY_SOURCE_TIERS.length).default([]),
    openAccessPdfUrl: boundedText(2000).nullable().default(null),
    openAccessPdfUrls: z.array(boundedText(2000)).max(10).optional()
  })
  .strict()

export const DISCOVERY_FAILURE_CODES = [
  'unavailable',
  'unauthorized',
  'rate-limited',
  'invalid-query',
  'no-results',
  'parse-failed'
] as const

export const discoverySourceStatusSchema = z
  .object({
    source: discoverySourceIdSchema,
    ok: z.boolean(),
    matched: z.number().int().min(0),
    returned: z.number().int().min(0),
    failureCode: z.enum(DISCOVERY_FAILURE_CODES).nullable().default(null),
    message: boundedText(2000).default(''),
    // CNKI is reached through an embedded browser session; when the session has no login state
    // the UI offers an explicit "sign in" step instead of reporting a bare failure.
    requiresLogin: z.boolean().default(false),
    rateLimitReason: z.enum(['daily-budget', 'request-rate']).optional(),
    retryAt: z.number().int().nonnegative().optional(),
    requiresApiKey: z.boolean().optional(),
    unresolvedTiers: z
      .array(discoverySourceTierSchema)
      .max(DISCOVERY_SOURCE_TIERS.length)
      .default([])
  })
  .strict()

export const discoverySearchResponseSchema = z
  .object({
    candidates: z.array(discoveryCandidateSchema).max(DISCOVERY_RESULT_LIMIT),
    statuses: z.array(discoverySourceStatusSchema).max(DISCOVERY_SOURCE_IDS.length),
    warnings: z.array(boundedText(1000)).max(20).default([])
  })
  .strict()

export const discoveryImportRequestSchema = z
  .object({
    collectionId: z.string().trim().min(1).max(512).nullable().default(null),
    duplicatePolicy: z.enum(['reuse', 'separate']).default('reuse'),
    candidates: z.array(discoveryCandidateSchema).min(1).max(DISCOVERY_RESULT_LIMIT)
  })
  .strict()

export const discoveryImportResultSchema = z
  .object({
    imported: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(512),
          itemId: z.string().trim().min(1).max(512)
        })
      )
      .max(DISCOVERY_RESULT_LIMIT),
    skipped: z
      .array(z.object({ key: z.string().trim().min(1).max(512), reason: boundedText(1000) }))
      .max(DISCOVERY_RESULT_LIMIT),
    importedCount: z.number().int().min(0),
    fullText: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(512),
          itemId: z.string().trim().min(1).max(512),
          status: z.enum(['downloaded', 'existing', 'not-found', 'failed']),
          reason: z
            .enum([
              'access-required',
              'verification-required',
              'pdf-unavailable',
              'download-failed'
            ])
            .optional()
        })
      )
      .max(DISCOVERY_RESULT_LIMIT)
      .optional()
  })
  .strict()

// Mirrors the screening criteria used by the PDF workflow. Kept structurally identical so a
// discovery screen run reads the same way in the report; the document text is the record itself.
export const discoveryCriteriaSchema = z
  .object({
    mode: z.enum(['all', 'any', 'custom']),
    items: z.array(z.string().trim().min(1).max(10_000)).min(1).max(50),
    notes: boundedText(10_000).default('')
  })
  .strict()

export const discoveryScreenRequestSchema = z
  .object({
    itemIds: z.array(z.string().trim().min(1).max(512)).min(1).max(DISCOVERY_RESULT_LIMIT),
    criteria: discoveryCriteriaSchema
  })
  .strict()

export const discoveryScreenOutcomeSchema = z
  .object({
    itemId: z.string().trim().min(1).max(512),
    decision: z.enum(['include', 'exclude', 'undecided']),
    reason: boundedText(10_000).default(''),
    failed: z.boolean().default(false)
  })
  .strict()

export const discoveryScreenResultSchema = z
  .object({
    outcomes: z.array(discoveryScreenOutcomeSchema).max(DISCOVERY_RESULT_LIMIT),
    includeCount: z.number().int().min(0),
    excludeCount: z.number().int().min(0),
    undecidedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0)
  })
  .strict()

export const discoveryParseRecordsRequestSchema = z
  .object({
    // The file is read by the renderer and passed as text, like the existing reference import.
    content: z
      .string()
      .min(1)
      .max(32 * 1024 * 1024)
  })
  .strict()

export const discoveryParseRecordsResultSchema = z
  .object({
    format: z.enum(['ris', 'endnote']),
    candidates: z.array(discoveryCandidateSchema).max(1000),
    errors: z.array(boundedText(2000)).max(20).default([])
  })
  .strict()

export const discoverySignInResponseSchema = z
  .object({
    signedIn: z.boolean(),
    message: boundedText(2000).default('')
  })
  .strict()

export const literatureDiscoveryContracts = Object.freeze({
  search: defineApplicationCommandContract(
    validationCodec(z.tuple([discoveryQuerySchema])),
    validationCodec(discoverySearchResponseSchema)
  ),
  import: defineApplicationCommandContract(
    validationCodec(z.tuple([discoveryImportRequestSchema])),
    validationCodec(discoveryImportResultSchema)
  ),
  screen: defineApplicationCommandContract(
    validationCodec(z.tuple([discoveryScreenRequestSchema])),
    validationCodec(discoveryScreenResultSchema)
  ),
  parseRecords: defineApplicationCommandContract(
    validationCodec(z.tuple([discoveryParseRecordsRequestSchema])),
    validationCodec(discoveryParseRecordsResultSchema)
  ),
  signIn: defineApplicationCommandContract(
    validationCodec(z.tuple([discoverySourceIdSchema])),
    validationCodec(discoverySignInResponseSchema)
  ),
  signOut: defineApplicationCommandContract(
    validationCodec(z.tuple([discoverySourceIdSchema])),
    validationCodec(discoverySignInResponseSchema)
  ),
  status: defineApplicationCommandContract(
    validationCodec(z.tuple([discoverySourceIdSchema])),
    validationCodec(discoverySignInResponseSchema)
  )
})

export type DiscoverySourceId = z.infer<typeof discoverySourceIdSchema>
export type DiscoveryDocumentType = z.infer<typeof discoveryDocumentTypeSchema>
export type DiscoverySourceTier = z.infer<typeof discoverySourceTierSchema>
export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>
export type DiscoverySourceStatus = z.infer<typeof discoverySourceStatusSchema>
export type DiscoverySearchResponse = z.infer<typeof discoverySearchResponseSchema>
export type DiscoveryImportRequest = z.infer<typeof discoveryImportRequestSchema>
export type DiscoveryImportResult = z.infer<typeof discoveryImportResultSchema>
export type DiscoveryCriteria = z.infer<typeof discoveryCriteriaSchema>
export type DiscoveryScreenRequest = z.infer<typeof discoveryScreenRequestSchema>
export type DiscoveryScreenResult = z.infer<typeof discoveryScreenResultSchema>
export type DiscoveryScreenOutcome = z.infer<typeof discoveryScreenOutcomeSchema>
export type DiscoveryParseRecordsRequest = z.infer<typeof discoveryParseRecordsRequestSchema>
export type DiscoveryParseRecordsResult = z.infer<typeof discoveryParseRecordsResultSchema>
export type DiscoverySignInResponse = z.infer<typeof discoverySignInResponseSchema>
export type DiscoveryFailureCode = (typeof DISCOVERY_FAILURE_CODES)[number]
