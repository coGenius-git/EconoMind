import { create } from 'zustand'

import { useNavigationStore } from './navigation-store'

// Like language and theme, the guide is remembered per device/profile. Setup itself remains
// owned by the durable Settings snapshot; replaying the guide never resets configuration.
export const PRODUCT_TOUR_STORAGE_KEY = 'economind-product-tour-v1'

export const hasSeenProductTour = (onboardingCompletedAt: number): boolean => {
  try {
    return localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY) === String(onboardingCompletedAt)
  } catch {
    return false
  }
}

type ProductTourState = {
  requested: boolean
  active: boolean
  stepIndex: number
  dismissedFor: number | undefined
  requestTour: () => void
  beginTour: () => void
  setStep: (stepIndex: number) => void
  finishTour: (onboardingCompletedAt: number) => void
}

export const useProductTourStore = create<ProductTourState>((set) => ({
  requested: false,
  active: false,
  stepIndex: 0,
  dismissedFor: undefined,
  requestTour: () => {
    set({ requested: true, active: false, stepIndex: 0 })
    // Preserve the existing unsaved-preview leave guard and all conversation drafts.
    useNavigationStore.getState().goHome('user')
  },
  beginTour: () => set({ requested: false, active: true, stepIndex: 0 }),
  setStep: (stepIndex) => set({ stepIndex }),
  finishTour: (onboardingCompletedAt) => {
    try {
      localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, String(onboardingCompletedAt))
    } catch {
      // Disabled storage must still allow dismissal for the current app session.
    }
    set({ requested: false, active: false, stepIndex: 0, dismissedFor: onboardingCompletedAt })
  }
}))
