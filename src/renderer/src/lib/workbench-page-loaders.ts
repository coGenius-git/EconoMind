// Share the import promises between intent/idle preloading and React.lazy. Loading code never
// mounts a page or runs its data effects, and a failed preload can be retried on navigation.
let library: Promise<typeof import('@/pages/literature/LiteratureLibraryPage')> | undefined
let workspace: Promise<typeof import('@/pages/workspace/WorkspacePage')> | undefined

export const loadLiteratureLibraryPage = (): Promise<
  typeof import('@/pages/literature/LiteratureLibraryPage')
> => {
  library ??= import('@/pages/literature/LiteratureLibraryPage').catch((error: unknown) => {
    library = undefined
    throw error
  })
  return library
}

export const loadWorkspacePage = (): Promise<typeof import('@/pages/workspace/WorkspacePage')> => {
  workspace ??= import('@/pages/workspace/WorkspacePage').catch((error: unknown) => {
    workspace = undefined
    throw error
  })
  return workspace
}

export const preloadWorkbenchPage = (view: 'library' | 'workspace'): Promise<void> =>
  (view === 'library' ? loadLiteratureLibraryPage() : loadWorkspacePage())
    .then(() => undefined)
    .catch((error: unknown) => console.warn(`Could not preload ${view}`, error))
