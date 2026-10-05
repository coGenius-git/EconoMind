import { z } from 'zod'
import type { DiscoveryScreenOutcome } from '../../../shared/literature-discovery'
import { generateScreeningJson } from '../screening-model'

// Title/abstract screening for records discovered from external sources. The PDF workflow parses
// full text; discovered records usually have no PDF, so the decision is made from the record
// metadata alone and every outcome says so through the decision reason.
export type RecordScreeningModel = Parameters<typeof generateScreeningJson>[0]

export type ScreeningRecord = {
  itemId: string
  title: string
  abstract: string
  year: number | null
  venue: string
}

export type ScreeningCriteriaInput = {
  mode: 'all' | 'any' | 'custom'
  items: string[]
  notes: string
}

const CONCURRENCY = 3

const decisionSchema = z.object({
  decision: z.enum(['include', 'exclude', 'undecided']),
  reason: z.string().trim().min(1).max(4000)
})

function criteriaPrompt(criteria: ScreeningCriteriaInput): string {
  const items = criteria.items.map((item, index) => `${index + 1}. ${item}`).join('\n')
  const rule =
    criteria.mode === 'all'
      ? 'Include the record only when it satisfies every listed criterion.'
      : criteria.mode === 'any'
        ? 'Include the record when it satisfies at least one listed criterion.'
        : 'Apply the listed criteria as written and explain how they were combined.'
  return `Inclusion criteria (${criteria.mode}):\n${items}\nRule: ${rule}${
    criteria.notes.trim() ? `\nReviewer notes: ${criteria.notes.trim()}` : ''
  }`
}

const SYSTEM_PROMPT = [
  'You screen academic records for a systematic literature review.',
  'You are given only the title, abstract (when available), year and venue of a record.',
  'Decide whether the record should be included, excluded, or left undecided.',
  'Be conservative: choose undecided when the supplied metadata is insufficient to judge.',
  'The reason must state which criteria the record met or failed, based only on the supplied text.',
  'Never claim to have read the full text.'
].join(' ')

async function screenOne(
  model: RecordScreeningModel,
  record: ScreeningRecord,
  criteria: ScreeningCriteriaInput,
  signal: AbortSignal
): Promise<DiscoveryScreenOutcome> {
  const prompt = [
    criteriaPrompt(criteria),
    '',
    `Title: ${record.title}`,
    `Year: ${record.year === null ? 'unknown' : record.year}`,
    `Venue: ${record.venue || 'unknown'}`,
    `Abstract: ${record.abstract.trim() ? record.abstract : '(no abstract available)'}`
  ].join('\n')
  try {
    const result = await generateScreeningJson(model, decisionSchema, SYSTEM_PROMPT, prompt, signal)
    return {
      itemId: record.itemId,
      decision: result.decision,
      reason: result.reason,
      failed: false
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    return {
      itemId: record.itemId,
      decision: 'undecided',
      reason: error instanceof Error ? error.message : 'The model could not screen this record.',
      failed: true
    }
  }
}

export async function screenRecords(
  model: RecordScreeningModel,
  records: readonly ScreeningRecord[],
  criteria: ScreeningCriteriaInput,
  signal?: AbortSignal
): Promise<DiscoveryScreenOutcome[]> {
  const abort = signal ?? new AbortController().signal
  const outcomes: DiscoveryScreenOutcome[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(CONCURRENCY, records.length) }, async () => {
    while (cursor < records.length) {
      const index = cursor
      cursor += 1
      outcomes.push(await screenOne(model, records[index], criteria, abort))
    }
  })
  await Promise.all(workers)
  return outcomes
}
