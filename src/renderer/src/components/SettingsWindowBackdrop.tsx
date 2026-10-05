import { useEffect, useState } from 'react'

// Native Settings owns its own window. This backdrop is purely visual and never traps input.
export function SettingsWindowBackdrop(): React.JSX.Element | null {
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    let active = true
    let receivedEvent = false
    const windowApi = window.api?.window
    const unsubscribe = windowApi?.onSettingsFocusChanged?.((next) => {
      receivedEvent = true
      if (active) setFocused(next)
    })
    void windowApi
      ?.isSettingsFocused?.()
      .then((next) => {
        if (active && !receivedEvent) setFocused(next)
      })
      .catch(() => undefined)
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  return focused ? (
    <div
      aria-hidden="true"
      data-slot="settings-window-backdrop"
      className="research-settings-focus-backdrop pointer-events-none fixed inset-0 z-[100]"
    />
  ) : null
}
