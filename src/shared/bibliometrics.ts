/**
 * Shared bibliometrics contract and pure analysis functions.
 *
 * The renderer panel reads the literature catalog (via the existing
 * `window.api.literature.search` paging channel), maps entries into
 * `BibliometricItemInput`, and runs `analyzeBibliometrics` — the main-process
 * service (`src/main/research-tools/bibliometrics.ts`) reuses the same
 * function for library-level analysis and for the bundled `bibliometrics`
 * skill. Everything here is deterministic and side-effect free so it can be
 * unit-tested in isolation.
 */

export interface BibliometricItemInput {
  id: string
  title: string
  year: number | null
  /** Explicit author-supplied keywords (from typeFields.keywords when present). */
  keywords: string[]
  venue?: string | null
  citations?: number | null
}

export interface KeywordCooccurrence {
  source: string
  target: string
  /** Number of documents in which both keywords co-occur. */
  weight: number
}

export interface KeywordCluster {
  id: string
  /** Representative label: the highest-frequency keyword in the cluster. */
  label: string
  keywords: string[]
  /** Number of documents that contain at least one keyword of the cluster. */
  documentCount: number
}

export interface KeywordHotspot {
  keyword: string
  totalCount: number
  recentCount: number
  /** Relative growth of the last `window` years vs. the preceding period; null when undefined. */
  growth: number | null
}

export interface TopicTrendPoint {
  year: number
  keyword: string
  count: number
}

export interface BibliometricsAnalysis {
  totalItems: number
  /** Inclusive year range of the analyzed documents, null when no dated item exists. */
  yearRange: [number, number] | null
  keywordNetwork: KeywordCooccurrence[]
  clusters: KeywordCluster[]
  hotspots: KeywordHotspot[]
  /** Per-year counts for the top keywords, ordered by year ascending. */
  trends: TopicTrendPoint[]
  /** Distinct keywords across all documents, with document counts. */
  keywordFrequencies: Array<{ keyword: string; count: number }>
}

export interface BibliometricsOptions {
  /** Maximum edges to keep in the network (default 60). */
  maxNetworkEdges?: number
  /** Number of top keywords to chart in the trend series (default 6). */
  topTrendKeywords?: number
  /** Number of top hotspots to return (default 10). */
  topHotspots?: number
  /** Window (in years) used for hotspot growth (default 3). */
  hotspotWindowYears?: number
}

const DEFAULT_OPTIONS: Required<BibliometricsOptions> = {
  maxNetworkEdges: 60,
  topTrendKeywords: 6,
  topHotspots: 10,
  hotspotWindowYears: 3
}

const ENGLISH_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'to',
  'with',
  'from',
  'by',
  'at',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'this',
  'that',
  'these',
  'those',
  'study',
  'studies',
  'analysis',
  'evidence',
  'role',
  'effect',
  'effects',
  'impact',
  'new',
  'toward',
  'towards',
  'review',
  'research',
  'using',
  'use',
  'based',
  'between',
  'among',
  'under',
  'over',
  'into',
  'its',
  'their',
  'our',
  'we',
  'can',
  'may',
  'will'
])

function normalizeToken(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Extracts keywords from a free-text title (English tokens + short CJK chunks). */
export function keywordsFromTitle(title: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const push = (token: string): void => {
    if (!token || token.length < 2) return
    if (seen.has(token)) return
    seen.add(token)
    result.push(token)
  }
  for (const chunk of title.split(/[\s,;:()[\]]+/)) {
    const normalized = normalizeToken(chunk)
    if (!normalized) continue
    // CJK chunks (no spaces) are kept as-is so Chinese titles still contribute.
    if (/[\p{Script=Han}]/u.test(chunk)) {
      push(normalized)
      continue
    }
    for (const word of normalized.split(' ')) {
      if (!ENGLISH_STOPWORDS.has(word)) push(word)
    }
  }
  return result.slice(0, 8)
}

function parseKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter((entry) => entry.length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[;|,]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  }
  return []
}

/** Normalizes a catalog item into the bibliometrics input shape. */
export function toBibliometricItem(item: {
  id: string
  title: string
  year?: number | null
  venue?: string | null
  authors?: unknown
  typeFields?: Record<string, unknown> | null
}): BibliometricItemInput {
  const explicit = parseKeywords(item.typeFields?.keywords)
  const keywords = explicit.length > 0 ? explicit : keywordsFromTitle(item.title)
  return {
    id: item.id,
    title: item.title,
    year: typeof item.year === 'number' && Number.isFinite(item.year) ? item.year : null,
    venue: item.venue ?? null,
    keywords
  }
}

export function analyzeBibliometrics(
  inputs: BibliometricItemInput[],
  options: BibliometricsOptions = {}
): BibliometricsAnalysis {
  const merged: Required<BibliometricsOptions> = { ...DEFAULT_OPTIONS, ...options }
  const items = inputs.filter((item) => item.keywords.length > 0)
  const totalItems = inputs.length

  // Keyword frequency across documents.
  const frequency = new Map<string, number>()
  for (const item of items) {
    for (const keyword of new Set(item.keywords)) {
      frequency.set(keyword, (frequency.get(keyword) ?? 0) + 1)
    }
  }
  const keywordFrequencies = [...frequency.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))

  // Co-occurrence network.
  const cooccurrence = new Map<string, number>()
  const edgeKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)
  for (const item of items) {
    const unique = [...new Set(item.keywords)]
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = edgeKey(unique[i], unique[j])
        cooccurrence.set(key, (cooccurrence.get(key) ?? 0) + 1)
      }
    }
  }
  const keywordNetwork = [...cooccurrence.entries()]
    .map(([key, weight]) => {
      const [source, target] = key.split('\u0000')
      return { source, target, weight }
    })
    .sort((a, b) => b.weight - a.weight || a.source.localeCompare(b.source))
    .slice(0, merged.maxNetworkEdges)

  // Keyword-level clusters: connected components of the (top) co-occurrence graph.
  const adjacency = new Map<string, Set<string>>()
  const link = (a: string, b: string): void => {
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    if (!adjacency.has(b)) adjacency.set(b, new Set())
    adjacency.get(a)!.add(b)
    adjacency.get(b)!.add(a)
  }
  for (const edge of keywordNetwork) link(edge.source, edge.target)
  const clusters: KeywordCluster[] = []
  const visited = new Set<string>()
  for (const entry of keywordFrequencies) {
    const keyword = entry.keyword
    if (visited.has(keyword)) continue
    const component: string[] = []
    const queue = [keyword]
    visited.add(keyword)
    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    if (component.length === 0) continue
    const label = [...component].sort(
      (a, b) => (frequency.get(b) ?? 0) - (frequency.get(a) ?? 0) || a.localeCompare(b)
    )[0]
    const memberSet = new Set(component)
    let documentCount = 0
    for (const item of items) {
      if (item.keywords.some((keyword) => memberSet.has(keyword))) documentCount += 1
    }
    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      label,
      keywords: [...component].sort(
        (a, b) => (frequency.get(b) ?? 0) - (frequency.get(a) ?? 0) || a.localeCompare(b)
      ),
      documentCount
    })
  }
  clusters.sort((a, b) => b.documentCount - a.documentCount || a.label.localeCompare(b.label))

  // Year range and hotspots (frequency + recent growth).
  const dated = items
    .map((item) => item.year)
    .filter((year): year is number => typeof year === 'number' && year > 0)
  const yearRange: [number, number] | null =
    dated.length > 0 ? [Math.min(...dated), Math.max(...dated)] : null

  const window = merged.hotspotWindowYears
  const latestYear = yearRange?.[1] ?? null
  const hotspots: KeywordHotspot[] = []
  if (latestYear !== null) {
    const recentFloor = latestYear - window
    for (const [keyword, count] of frequency) {
      let recentCount = 0
      let priorCount = 0
      for (const item of items) {
        if (item.year === null || item.year < 1) continue
        if (item.keywords.includes(keyword)) {
          if (item.year > recentFloor) recentCount += 1
          else priorCount += 1
        }
      }
      const growth =
        priorCount > 0 ? (recentCount - priorCount) / priorCount : recentCount > 0 ? null : 0
      hotspots.push({ keyword, totalCount: count, recentCount, growth })
    }
    hotspots.sort(
      (a, b) =>
        (b.growth === null ? Number.POSITIVE_INFINITY : b.growth) -
          (a.growth === null ? Number.POSITIVE_INFINITY : a.growth) || b.totalCount - a.totalCount
    )
  } else {
    for (const [keyword, count] of frequency) {
      hotspots.push({ keyword, totalCount: count, recentCount: 0, growth: null })
    }
    hotspots.sort((a, b) => b.totalCount - a.totalCount)
  }

  // Per-year trend series for the top keywords.
  const trendKeywords = keywordFrequencies
    .slice(0, merged.topTrendKeywords)
    .map((entry) => entry.keyword)
  const trends: TopicTrendPoint[] = []
  if (yearRange !== null) {
    for (let year = yearRange[0]; year <= yearRange[1]; year++) {
      for (const keyword of trendKeywords) {
        let count = 0
        for (const item of items) {
          if (item.year === year && item.keywords.includes(keyword)) count += 1
        }
        if (count > 0) trends.push({ year, keyword, count })
      }
    }
  }

  return {
    totalItems,
    yearRange,
    keywordNetwork,
    clusters,
    hotspots: hotspots.slice(0, merged.topHotspots),
    trends,
    keywordFrequencies: keywordFrequencies.slice(0, 50)
  }
}
