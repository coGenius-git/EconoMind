import { useEffect, useLayoutEffect, useRef } from 'react'
import type { SpecialistListItem } from '../../../../shared/specialist'

export type SpecialistSummonRequest = {
  requestId: number
  draftKey: string
  specialistId: string
}

// A catalog summon targets a new-conversation draft, never the session being left. The composer
// restores its destination in a parent layout effect; defer until that render before capturing
// the example-prefill baseline so an outgoing session's text cannot become that baseline.
export const useSpecialistSummon = ({
  request,
  scopeKey,
  activeSessionId,
  canEdit,
  items,
  select,
  consumed
}: {
  request?: SpecialistSummonRequest
  scopeKey: string
  activeSessionId?: string
  canEdit: boolean
  items: SpecialistListItem[]
  select: (specialistId: string | undefined) => void
  consumed?: (requestId: number) => void
}): void => {
  const lastConsumed = useRef<number | undefined>(undefined)
  const currentSelect = useRef(select)
  useLayoutEffect(() => {
    currentSelect.current = select
  }, [select])

  useEffect(() => {
    if (
      !request ||
      lastConsumed.current === request.requestId ||
      activeSessionId ||
      !canEdit ||
      scopeKey !== request.draftKey
    ) {
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || lastConsumed.current === request.requestId) return
      lastConsumed.current = request.requestId
      const item = items.find(
        (candidate) => candidate.kind !== 'reviewer' && candidate.id === request.specialistId
      )
      if (item && item.kind !== 'reviewer' && item.enabled && !item.setupPending) {
        currentSelect.current(item.id)
      }
      consumed?.(request.requestId)
    })
    return () => {
      cancelled = true
    }
  }, [request, scopeKey, activeSessionId, canEdit, items, consumed])
}
