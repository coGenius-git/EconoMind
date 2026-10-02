import type { ConnectorGroup } from '../../shared/settings'

export type ConnectorMeta = {
  id: string
  displayName: string
  // User-facing/source aliases used by the bridge's deterministic per-turn router.
  aliases?: string[]
  description: string
  // Trigger-style summary ("Use when …") that drives automatic skill discovery — the agent matches a
  // plain user question against this without the user naming the connector. Keep it query-oriented.
  useWhen: string
  sources: string[]
  termsUrl?: string
  requiresNcbi: boolean
  // Settings-list section. Absent = "featured" (Anthropic research connectors); "directory" connectors
  // mirror entries in the Claude Connectors Directory.
  group?: ConnectorGroup
}

// Static connector metadata for the settings UI (tool lists come from the registry).
// EconoMind is domain-tuned for economics & management research: the literature graph
// (OpenAlex + arXiv) is the sole built-in research connector.
export const CONNECTOR_CATALOG: ConnectorMeta[] = [
  {
    id: 'literature',
    displayName: 'Literature Graph',
    description:
      'Scholarly literature graph — OpenAlex works/authors/venues/citations, arXiv metadata.',
    useWhen:
      'Use when exploring the scholarly literature graph — searching works/papers by topic with citation counts and authors, following a work’s citations or references, looking up authors (ORCID, h-index, institution) or a venue/journal, or searching arXiv preprints. Sourced from OpenAlex and arXiv.',
    sources: ['OpenAlex', 'arXiv'],
    termsUrl: 'https://docs.openalex.org/additional-help/terms',
    requiresNcbi: false
  }
]
