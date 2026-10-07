export const SETTINGS_PANEL_IDS = [
  'model',
  'agent',
  'skills',
  'connectors',
  'specialists',
  'memory',
  'tags',
  'compute',
  'permissions',
  'credentials',
  'archived',
  'usage',
  'general',
  'storage',
  'network',
  'runtimes'
] as const

export type SettingsPanelId = (typeof SETTINGS_PANEL_IDS)[number]
export type SettingsWindowNavigation = {
  kind:
    | 'session'
    | 'project'
    | 'literature'
    | 'customize-skill'
    | 'customize-specialist'
    | 'wsl-support'
    | 'wsl-create-project'
    | 'product-tour'
  id: string
}

// The native window relays renderer-owned routes; it never executes their view data.
export const parseSettingsWindowRoute = (
  serialized: unknown
): { panel: SettingsPanelId; view?: Record<string, unknown> } | undefined => {
  if (typeof serialized !== 'string' || serialized.length > 32_768) return undefined
  try {
    const route = JSON.parse(serialized)
    if (!route || !SETTINGS_PANEL_IDS.includes(route.panel)) return undefined
    if (
      [
        'model',
        'skills',
        'connectors',
        'network',
        'compute',
        'credentials',
        'specialists',
        'archived',
        'memory',
        'tags'
      ].includes(route.panel) &&
      !route.view
    )
      return undefined
    if (
      route.view !== undefined &&
      (!route.view ||
        typeof route.view !== 'object' ||
        Array.isArray(route.view) ||
        typeof route.view.kind !== 'string')
    )
      return undefined
    return route
  } catch {
    return undefined
  }
}

export const isSettingsWindow = (): boolean =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('window') === 'settings'
