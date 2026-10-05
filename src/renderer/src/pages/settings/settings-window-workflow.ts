import { isSettingsWindow, type SettingsWindowNavigation } from '../../../../shared/settings-window'

export const SETTINGS_WINDOW_WORKFLOW_EVENT = 'settings-window-workflow'

// The Settings window owns its leave guard; only the main renderer owns workflow drafts.
export const requestSettingsWindowWorkflow = (request: SettingsWindowNavigation): boolean => {
  if (!isSettingsWindow()) return false
  window.dispatchEvent(new CustomEvent(SETTINGS_WINDOW_WORKFLOW_EVENT, { detail: request }))
  return true
}
