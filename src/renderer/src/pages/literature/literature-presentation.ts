import type { LiteratureItemInput, LiteratureItemView } from '../../../../shared/literature'
import {
  createLiteratureAttachmentVersionReference,
  normalizeLiteratureIdentifierValue
} from '../../../../shared/literature'
import { LITERATURE_PREVIEW_SESSION_ID } from '../workspace/preview-file-item'
import type { PreviewFileItem } from '@/stores/preview-workbench-store'

const creatorNames = (item: LiteratureItemInput): string[] =>
  item.creators.map((creator) =>
    creator.nameMode === 'organization'
      ? creator.literalName
      : [creator.givenName, creator.familyName].filter(Boolean).join(' ')
  )

export const creatorLabel = (item: LiteratureItemInput): string =>
  creatorNames(item).slice(0, 3).join(', ')

export const fullCreatorLabel = (item: LiteratureItemInput): string => creatorNames(item).join(', ')

export const typeFieldText = (item: LiteratureItemInput, field: string): string => {
  const value = item.typeFields[field]
  return typeof value === 'string' ? value.trim() : ''
}

export const publicationSummary = (item: LiteratureItemInput): string => {
  const publication = item.shortTitle || item.containerTitle
  const date = item.issuedText || item.issuedYear?.toString() || ''
  const volume = typeFieldText(item, 'volume')
  const issue = typeFieldText(item, 'issue')
  const pages = typeFieldText(item, 'pages')
  const doiIdentifier = item.identifiers.find((identifier) => identifier.scheme === 'doi')
  const doi = doiIdentifier
    ? normalizeLiteratureIdentifierValue(doiIdentifier.scheme, doiIdentifier.value)
    : undefined
  const volumeIssue = `${volume}${issue ? `(${issue})` : ''}`
  const volumeIssuePages = volumeIssue && pages ? `${volumeIssue}:${pages}` : volumeIssue || pages
  const citation = `${[publication, date].filter(Boolean).join('. ')}${
    volumeIssuePages ? `${publication || date ? ';' : ''}${volumeIssuePages}` : ''
  }`
  return [citation, doi ? `doi: ${doi}` : ''].filter(Boolean).join('. ')
}

export const literaturePreviewItem = (entry: LiteratureItemView): PreviewFileItem | undefined => {
  const version = entry.attachments.find((attachment) => attachment.versions[0])?.versions[0]
  if (entry.deletedAt !== undefined || !version || version.availability === 'unavailable')
    return undefined
  return {
    id: `literature:${version.id}`,
    sessionId: LITERATURE_PREVIEW_SESSION_ID,
    title: version.filename,
    type: 'file',
    source: 'literature',
    path: createLiteratureAttachmentVersionReference(version.id),
    format: 'pdf',
    name: version.filename,
    mimeType: version.contentType,
    size: version.sizeBytes,
    versionNumber: version.versionNumber
  }
}
