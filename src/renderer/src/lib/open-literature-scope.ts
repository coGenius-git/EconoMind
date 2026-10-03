import { useNavigationStore } from '@/stores/navigation-store'
import type { LibraryPreviewScopeRequest } from '@/pages/workspace/previews/library-reference-actions'

// EconoMind keeps library navigation on its full page, including mentions inside nested chats.
export function openLiteratureScope(projectId: string, scope: LibraryPreviewScopeRequest): void {
  const navigation = useNavigationStore.getState()
  if (scope.section === 'inbox') navigation.openLibrary('user')
  else if (scope.collectionId) navigation.openCollectionLiterature(scope.collectionId, 'user')
  else navigation.openProjectLiterature(projectId, 'user')
}
