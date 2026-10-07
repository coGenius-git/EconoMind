// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { i18next } from '@/i18n'
import { useNavigationStore } from '@/stores/navigation-store'
import { PRODUCT_TOUR_STORAGE_KEY, useProductTourStore } from '@/stores/product-tour-store'
import { createInitialSettingsState, useSettingsStore } from '@/stores/settings-store'
import { ProductTour } from './ProductTour'
import { PRODUCT_TOUR_STEPS } from './product-tour-steps'

let targets: HTMLDivElement

beforeEach(async () => {
  localStorage.clear()
  await i18next.changeLanguage('en')
  useSettingsStore.setState(createInitialSettingsState())
  useNavigationStore.setState({ view: 'home' })
  useProductTourStore.setState({
    requested: false,
    active: false,
    stepIndex: 0,
    dismissedFor: undefined,
    workspaceProjectId: undefined
  })
  targets = document.createElement('div')
  for (const step of PRODUCT_TOUR_STEPS) {
    const element = document.createElement('div')
    element.dataset.productTour = step.target
    targets.appendChild(element)
  }
  document.body.appendChild(targets)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 16,
    top: 16,
    right: 336,
    bottom: 116,
    width: 320,
    height: 100,
    x: 16,
    y: 16,
    toJSON: () => ({})
  })
})

afterEach(() => {
  cleanup()
  targets.remove()
  vi.restoreAllMocks()
})

it('waits for saved setup and the ready home surface before starting automatically', () => {
  const { rerender } = render(<ProductTour ready={false} />)
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => useSettingsStore.setState({ onboardingCompletedAt: 42 }))
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => useNavigationStore.setState({ view: 'workspace' }))
  rerender(<ProductTour ready />)
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => useNavigationStore.setState({ view: 'home' }))
  expect(screen.getByRole('dialog', { name: 'New user guide' })).toBeTruthy()
})

it('advances and goes back, and remembers skipping across renderer remounts', () => {
  useSettingsStore.setState({ onboardingCompletedAt: 42 })
  const { unmount } = render(<ProductTour ready />)
  expect(
    (screen.getByRole('button', { name: 'Previous step' }) as HTMLButtonElement).disabled
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
  expect(screen.getByRole('heading', { name: 'Start with a project' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
  expect(screen.getByRole('heading', { name: 'Your research home' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY)).toBe('42')
  unmount()
  useProductTourStore.setState({ dismissedFor: undefined })
  render(<ProductTour ready />)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('honors manual replay without a setup timestamp, while leaving automatic setup gating intact', () => {
  const settings = useSettingsStore.getState()
  const { rerender } = render(<ProductTour ready />)
  expect(screen.queryByRole('dialog')).toBeNull()
  rerender(<ProductTour ready={false} />)
  act(() => useProductTourStore.getState().requestTour())
  expect(screen.queryByRole('dialog')).toBeNull()
  rerender(<ProductTour ready />)
  expect(screen.getByRole('heading', { name: 'Your research home' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY)).toBeNull()
  expect(useSettingsStore.getState()).toBe(settings)
})

it('finishes the guide and replays from the first step without resetting configuration', () => {
  useSettingsStore.setState({ onboardingCompletedAt: 42, notificationsEnabled: false })
  const settings = useSettingsStore.getState()
  const goHome = vi.spyOn(useNavigationStore.getState(), 'goHome')
  render(<ProductTour ready />)
  for (let index = 0; index < PRODUCT_TOUR_STEPS.length - 1; index++) {
    const next = screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement
    expect(next.disabled, `Next disabled at step ${index}`).toBe(false)
    fireEvent.click(next)
  }
  expect(screen.getByRole('heading', { name: 'Make the workspace yours' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Finish guide' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => useProductTourStore.getState().requestTour())
  expect(goHome).toHaveBeenCalledWith('user')
  expect(screen.getByRole('heading', { name: 'Your research home' })).toBeTruthy()
  expect(useSettingsStore.getState()).toBe(settings)
})

it('navigates into the library and the real empty workspace, then returns home', () => {
  useSettingsStore.setState({ onboardingCompletedAt: 42 })
  render(<ProductTour ready />)
  act(() => useProductTourStore.getState().setStep(4))
  expect(useNavigationStore.getState().view).toBe('library')
  expect(screen.getByRole('heading', { name: 'Explore your literature library' })).toBeTruthy()
  act(() => useProductTourStore.getState().setStep(12))
  expect(useNavigationStore.getState().view).toBe('workspace')
  expect(useNavigationStore.getState().activeProjectId).toBeUndefined()
  act(() => useProductTourStore.getState().setStep(19))
  expect(useNavigationStore.getState().view).toBe('home')
})

it('waits for lazy page targets and remeasures after the mobile drawer transition', async () => {
  useSettingsStore.setState({ onboardingCompletedAt: 42 })
  render(<ProductTour ready />)
  const sidebar = targets.querySelector<HTMLElement>('[data-product-tour="workspace-sidebar"]')!
  const visibleBounds = sidebar.getBoundingClientRect()
  const bounds = vi.spyOn(sidebar, 'getBoundingClientRect').mockReturnValue({
    ...visibleBounds,
    left: -320,
    right: 0
  })
  act(() => useProductTourStore.getState().setStep(13))
  expect((screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled).toBe(
    true
  )
  bounds.mockReturnValue(visibleBounds)
  fireEvent.transitionEnd(sidebar)
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled).toBe(
      false
    )
  )
  targets
    .querySelectorAll('[data-product-tour="library-content"]')
    .forEach((element) => element.remove())
  act(() => useProductTourStore.getState().setStep(4))
  expect((screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled).toBe(
    true
  )
  const library = document.createElement('div')
  library.dataset.productTour = 'library-content'
  targets.appendChild(library)
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled).toBe(
      false
    )
  )
})

it('keeps dismissal effective in this session when device storage is unavailable', () => {
  useSettingsStore.setState({ onboardingCompletedAt: 42 })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage disabled')
  })
  const { rerender } = render(<ProductTour ready />)
  fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }))
  rerender(<ProductTour ready={false} />)
  rerender(<ProductTour ready />)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('dismisses with Escape and displays the Chinese guide', async () => {
  await i18next.changeLanguage('zh-Hans')
  useSettingsStore.setState({ onboardingCompletedAt: 42 })
  render(<ProductTour ready />)
  expect(screen.getByRole('dialog', { name: '新手引导' })).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('button', { name: '下一步' }), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY)).toBe('42')
})
