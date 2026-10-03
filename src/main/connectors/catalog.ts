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
export const CONNECTOR_CATALOG: ConnectorMeta[] = [
  {
    id: 'literature',
    displayName: 'Literature Graph',
    description: 'Literature and research data via OpenAlex, arXiv, Crossref and DataCite.',
    useWhen:
      'Use when exploring the scholarly literature graph — searching works/papers by topic with citation counts and authors, following a work’s citations or references, looking up authors (ORCID, h-index, institution) or a venue/journal, searching arXiv preprints, checking Crossref bibliographic metadata and deposited corrections/retractions, or discovering DataCite datasets/software and their publication relationships. Sourced from OpenAlex, arXiv, Crossref and DataCite.',
    sources: ['OpenAlex', 'arXiv', 'Crossref', 'DataCite'],
    termsUrl: 'https://docs.openalex.org/additional-help/terms',
    requiresNcbi: false
  },

  {
    id: 'research-resources',
    displayName: 'Research Resources',
    description: 'Funding-opportunity search via Grants.gov.',
    useWhen:
      'Use when researching U.S. federal funding opportunities by keyword, agency, status, eligibility or funding category. Sourced from Grants.gov.',
    sources: ['Grants.gov'],
    termsUrl: 'https://www.grants.gov/',
    requiresNcbi: false
  },

  {
    id: 'zenodo',
    displayName: 'Zenodo',
    description: 'Public research records, versions and file metadata from Zenodo.',
    useWhen:
      'Use when discovering datasets, software or publications deposited in Zenodo, inspecting record and concept DOIs, or listing file names, sizes, checksums and download links for a record. Searches fetch one page of public metadata; file access may be restricted. No uploads or file downloads.',
    sources: ['Zenodo'],
    termsUrl: 'https://about.zenodo.org/terms/',
    requiresNcbi: false
  }
]
