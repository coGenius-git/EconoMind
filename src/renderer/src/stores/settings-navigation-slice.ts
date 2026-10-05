import type { ComputeAuthenticationErrorCode } from '../../../shared/compute'
import {
  settingsPanelRoute,
  type SettingsPanelId,
  type SettingsRoute
} from '../pages/settings/settings-navigation'
import { rememberSettingsReturnFocusTarget } from './settings-return-focus'
import { isSettingsWindow } from '../../../shared/settings-window'

export type SettingsNavigationIntent = Readonly<{
  requestId: number
  route: SettingsRoute
}>

let settingsNavigationRequestId = 0

export type SettingsNavigationState = {
  isSettingsOpen: boolean
  pendingSettingsIntent?: SettingsNavigationIntent
}

export type SettingsNavigationActions = {
  openSettings: () => void
  openSettingsToRoute: (route: SettingsRoute) => void
  openSettingsToPanel: (panel: SettingsPanelId) => void
  openSettingsToClassification: () => void
  openSettingsToOpenAlex: () => void
  closeSettings: () => void
  openSettingsToSkill: (skillId: string) => void
  openSettingsToSpecialist: (specialistId: string, kind?: 'custom' | 'builtin') => void
  openSettingsToCompute: () => void
  openSettingsToComputeHost: (providerId: string) => void
  openSettingsToComputeAuthentication: (
    providerId: string,
    errorCode: ComputeAuthenticationErrorCode
  ) => void
  consumePendingSettingsIntent: (requestId: number) => void
}

type SettingsNavigationSliceOptions = {
  getState: () => SettingsNavigationState
  setState: (patch: Partial<SettingsNavigationState>) => void
}

export const createInitialSettingsNavigationState = (): SettingsNavigationState => ({
  isSettingsOpen: false,
  pendingSettingsIntent: undefined
})

// Owns global dialog visibility and a one-shot landing intent. Caller-facing actions remain stable;
// route construction, mutual exclusion, and repeated-intent identity stay behind this module's seam.
export const createSettingsNavigationSlice = ({
  getState,
  setState
}: SettingsNavigationSliceOptions): SettingsNavigationActions => {
  const openTo = (route?: SettingsRoute, requestId?: number): void => {
    const openLocally = (): void => {
      rememberSettingsReturnFocusTarget(getState().isSettingsOpen)
      setState({
        isSettingsOpen: true,
        ...(route
          ? {
              pendingSettingsIntent: {
                requestId: requestId ?? ++settingsNavigationRequestId,
                route
              }
            }
          : {})
      })
    }
    if (typeof window !== 'undefined' && window.api?.window?.openSettings && !isSettingsWindow()) {
      void window.api.window
        .openSettings(route ? JSON.stringify(route) : undefined)
        .catch((error) => {
          console.warn('Could not open the Settings window', error)
          openLocally()
        })
    } else openLocally()
  }

  return {
    openSettings: () => openTo(),
    openSettingsToRoute: (route) => openTo(route),

    openSettingsToPanel: (panel) => openTo(settingsPanelRoute(panel)),
    openSettingsToClassification: () =>
      openTo({ panel: 'model', view: { kind: 'classification' } }),
    openSettingsToOpenAlex: () =>
      openTo({ panel: 'credentials', view: { kind: 'service', serviceId: 'openalex' } }),

    closeSettings: () =>
      setState({
        isSettingsOpen: false,
        pendingSettingsIntent: undefined
      }),

    openSettingsToSkill: (skillId) =>
      openTo({ panel: 'skills', view: { kind: 'detail', id: skillId } }),

    openSettingsToSpecialist: (specialistId, kind = 'custom') =>
      openTo({
        panel: 'specialists',
        view: { kind: kind === 'builtin' ? 'builtin' : 'edit', id: specialistId }
      }),

    openSettingsToCompute: () => openTo({ panel: 'compute', view: { kind: 'list' } }),

    openSettingsToComputeHost: (providerId) =>
      openTo({ panel: 'compute', view: { kind: 'detail', providerId } }),

    openSettingsToComputeAuthentication: (providerId, errorCode) => {
      const requestId = ++settingsNavigationRequestId
      openTo(
        {
          panel: 'compute',
          view: {
            kind: 'detail',
            providerId,
            authenticationFocus: errorCode,
            authenticationRequestId: requestId
          }
        },
        requestId
      )
    },

    consumePendingSettingsIntent: (requestId) => {
      if (getState().pendingSettingsIntent?.requestId !== requestId) return
      setState({ pendingSettingsIntent: undefined })
    }
  }
}
