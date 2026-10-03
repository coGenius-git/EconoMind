import { useTranslation } from 'react-i18next'
import { LiteratureDiscoveryPanel } from './LiteratureDiscoveryPanel'
import { LiteratureImportDialogFrame } from '../imports/LiteratureImportDialogFrame'

export function LiteratureDiscoveryDialog({
  onClose,
  collectionId,
  onImported
}: {
  onClose: () => void
  collectionId?: string
  onImported?: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <LiteratureImportDialogFrame
      title={t('Search external sources')}
      description={t(
        'Find records by topic and criteria, then import the ones you want to screen.'
      )}
      busy={false}
      onClose={onClose}
      footer={null}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <LiteratureDiscoveryPanel collectionId={collectionId} onImported={onImported} />
      </div>
    </LiteratureImportDialogFrame>
  )
}

export default LiteratureDiscoveryDialog
