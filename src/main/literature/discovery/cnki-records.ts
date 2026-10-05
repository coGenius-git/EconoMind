import { createHash } from 'node:crypto'
import {
  type DiscoveryCandidate,
  type DiscoveryDocumentType
} from '../../../shared/literature-discovery'

// CNKI has no usable API and its embedded sign-in flow does not survive in the app's window, so
// records arrive the way a reviewer already exports them: search on the site, then export the
// selected references. Both export flavours CNKI offers are plain tagged text.
export type CnkiRecordFormat = 'ris' | 'endnote'
export type CnkiParseResult = {
  format: CnkiRecordFormat
  candidates: DiscoveryCandidate[]
  errors: string[]
}

const RIS_TAGS: Readonly<
  Record<
    string,
    | 'title'
    | 'authors'
    | 'venue'
    | 'year'
    | 'abstract'
    | 'doi'
    | 'url'
    | 'type'
    | 'language'
    | 'publisher'
  >
> = {
  T1: 'title',
  TI: 'title',
  A1: 'authors',
  AU: 'authors',
  JF: 'venue',
  JO: 'venue',
  T2: 'venue',
  YR: 'year',
  PY: 'year',
  AB: 'abstract',
  N2: 'abstract',
  DO: 'doi',
  UR: 'url',
  RT: 'type',
  LA: 'language',
  PB: 'publisher',
  TY: 'type'
}

const ENDNOTE_TAGS: Readonly<Record<string, (typeof RIS_TAGS)[keyof typeof RIS_TAGS]>> = {
  '%T': 'title',
  '%A': 'authors',
  '%J': 'venue',
  '%B': 'venue',
  '%D': 'year',
  '%X': 'abstract',
  '%R': 'doi',
  '%U': 'url',
  '%0': 'type',
  '%G': 'language',
  '%I': 'publisher'
}

const TYPE_LABELS: ReadonlyArray<readonly [string, DiscoveryDocumentType]> = [
  ['学位论文', 'dissertation'],
  ['thesis', 'dissertation'],
  ['dissertation', 'dissertation'],
  ['会议', 'conference'],
  ['conference', 'conference'],
  ['proceeding', 'conference'],
  ['综述', 'review'],
  ['review', 'review'],
  ['报纸', 'other'],
  ['newspaper', 'other'],
  ['图书', 'book'],
  ['book', 'book'],
  ['期刊', 'article'],
  ['journal', 'article'],
  ['article', 'article']
]

function detectFormat(text: string): CnkiRecordFormat | undefined {
  for (const line of text.split(/\r?\n/u).slice(0, 40)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^%[0-9A-Z]/u.test(trimmed)) return 'endnote'
    if (/^[A-Z][0-9A-Z]\s+/u.test(trimmed)) return 'ris'
  }
  return undefined
}

function mapType(value: string, fallbackText = ''): DiscoveryDocumentType {
  const haystack = `${value} ${fallbackText}`.toLowerCase()
  for (const [label, type] of TYPE_LABELS) if (haystack.includes(label.toLowerCase())) return type
  return 'article'
}

function parseYear(value: string): number | null {
  const match = /\d{4}/u.exec(value)
  if (!match) return null
  const year = Number(match[0])
  return year >= 1000 && year <= 9999 ? year : null
}

function normalizeDoi(value: string): string {
  return value.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//iu, '')
}

function keyFor(parts: readonly string[]): string {
  const seed = parts.filter(Boolean).join('|')
  return `cnki:${createHash('sha256').update(seed).digest('hex').slice(0, 24)}`
}

function splitRecords(text: string, format: CnkiRecordFormat): string[][] {
  const lines = text.split(/\r?\n/u)
  const records: string[][] = []
  let current: string[] = []
  const isStart = (line: string): boolean =>
    format === 'endnote' ? /^%0\s+\S/u.test(line.trim()) : /^(?:RT|TY)\s+\S/u.test(line.trim())
  for (const line of lines) {
    if (format === 'ris' && /^ER\s+-/u.test(line.trim())) {
      if (current.length) records.push(current)
      current = []
      continue
    }
    if (isStart(line)) {
      if (current.length) records.push(current)
      current = [line]
      continue
    }
    if (/^\s*$/u.test(line)) {
      if (current.length) {
        records.push(current)
        current = []
      }
      continue
    }
    current.push(line)
  }
  if (current.length) records.push(current)
  return records
}

function buildCandidate(
  record: readonly string[],
  format: CnkiRecordFormat
): DiscoveryCandidate | undefined {
  const tags = format === 'endnote' ? ENDNOTE_TAGS : RIS_TAGS
  const raw: Record<string, string[]> = {}
  for (const line of record) {
    // Both formats continue a tag on lines that start with whitespace.
    const continuation = /^\s+/u.test(line) && !/^\s*[A-Z%]/u.test(line)
    const match = /^\s*([A-Z][0-9A-Z]|%[0-9A-Z])\s+(?:-\s+)?([\s\S]*)$/u.exec(line)
    if (!match) {
      if (continuation) {
        const keys = Object.keys(raw)
        const last = keys[keys.length - 1]
        if (last) raw[last].push(line.trim())
      }
      continue
    }
    const [, tag, value] = match
    const field = tags[tag.toUpperCase()]
    if (!field) continue
    raw[field] = [...(raw[field] ?? []), value.trim()]
  }
  const join = (field: string): string => (raw[field] ?? []).join(' ').trim()
  const title = join('title').slice(0, 2000)
  if (!title) return undefined
  const authors = (raw.authors ?? [])
    .map((value) =>
      value
        .replace(/\s*;\s*$/u, '')
        .trim()
        .slice(0, 300)
    )
    .filter(Boolean)
    .slice(0, 100)
  const typeValue = join('type')
  const abstract = join('abstract').slice(0, 20_000)
  const doi = normalizeDoi(join('doi')).slice(0, 300)
  const url = join('url').slice(0, 2000)
  const year = parseYear(join('year'))
  return {
    key: keyFor([title, String(year ?? ''), authors[0] ?? '']),
    source: 'cnki',
    externalId: (doi || url || title).slice(0, 512),
    title,
    authors,
    year,
    venue: join('venue').slice(0, 1000),
    documentType: mapType(typeValue, join('publisher')),
    doi,
    url: url || (doi ? `https://doi.org/${doi}` : ''),
    abstract,
    citationCount: null,
    sourceTiers: [],
    openAccessPdfUrl: null
  }
}

export function parseCnkiRecords(text: string): CnkiParseResult {
  const format = detectFormat(text)
  const errors: string[] = []
  if (!format) {
    return {
      format: 'ris',
      candidates: [],
      errors: [
        'This file is not a CNKI export. Export the selected references as RefWorks or EndNote from CNKI and try again.'
      ]
    }
  }
  const candidates: DiscoveryCandidate[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const record of splitRecords(text, format)) {
    if (candidates.length >= 1000) {
      errors.push('Only the first 1000 records were parsed.')
      break
    }
    const candidate = buildCandidate(record, format)
    if (!candidate) {
      skipped += 1
      continue
    }
    if (seen.has(candidate.key)) continue
    seen.add(candidate.key)
    candidates.push(candidate)
  }
  if (skipped) errors.push(`${skipped} record(s) without a title were skipped.`)
  if (!candidates.length && !errors.length) errors.push('No references were found in this file.')
  return { format, candidates, errors }
}
