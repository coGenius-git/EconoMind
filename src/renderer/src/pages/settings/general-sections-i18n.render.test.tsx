// @vitest-environment jsdom
// Verifies the active General About section reads its attribution from translated catalogs.
import { act } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18next } from '@/i18n'
import { useUpdateStore } from '@/stores/update-store'
import { AppVersionSection } from './AppVersionSection'

vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))

let container: HTMLDivElement
let root: Root

const render = (element: React.JSX.Element): void => {
  act(() => {
    root.render(element)
  })
}

const switchTo = (language: string): void => {
  act(() => {
    void i18next.changeLanguage(language)
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  useUpdateStore.setState({
    appInfo: { name: 'EconoMind', version: '0.2.0', copyright: '© 2026 AIPOCH.' },
    status: { state: 'up-to-date', current: '0.2.0', latest: '0.2.0' }
  })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  switchTo('en')
})

describe('AppVersionSection', () => {
  it('translates the customized edition attribution and exposes no external controls', () => {
    render(<AppVersionSection />)
    expect(container.textContent).toContain('About')
    expect(container.textContent).toContain('Customized edition')
    switchTo('zh-Hans')
    expect(container.textContent).toContain('定制版本')
    switchTo('zh-Hant')
    expect(container.textContent).toContain('自訂版本')
    expect(container.querySelectorAll('a,button')).toHaveLength(0)
  })
})
