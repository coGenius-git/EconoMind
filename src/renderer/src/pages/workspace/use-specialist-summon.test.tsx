// @vitest-environment jsdom
import { act, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { TFunction } from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BuiltinSpecialistEntry, SpecialistListItem } from '../../../../shared/specialist'
import { docToText, type ComposerDoc } from './composer/composer-doc'
import { useSpecialistExample } from './use-specialist-example'
import { useSpecialistSummon, type SpecialistSummonRequest } from './use-specialist-summon'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const t = ((key: string) => key) as TFunction
const builtin = (id = 'literature-review-agent', enabled = true): BuiltinSpecialistEntry =>
  ({ kind: 'builtin', id, enabled }) as BuiltinSpecialistEntry
const textDoc = (text: string): ComposerDoc => ({ nodes: [{ type: 'text', text }] })
const cleanup: Array<() => void> = []
afterEach(() => cleanup.splice(0).forEach((fn) => fn()))

type Harness = {
  selected: ReturnType<typeof vi.fn>
  consumed: ReturnType<typeof vi.fn>
  summon: () => Promise<void>
  rerender: () => void
  value: () => string
  binding: () => string | undefined
}
const mount = (restoredDoc: ComposerDoc, items: SpecialistListItem[] = [builtin()]): Harness => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const selected = vi.fn()
  const consumed = vi.fn()
  let summon!: () => void
  let rerender!: () => void
  let value = ''
  let binding: string | undefined
  const Probe = (): null => {
    const [scope, setScope] = useState('session-a')
    const [doc, setDoc] = useState(textDoc('Outgoing conversation draft'))
    const [selectedId, setSelectedId] = useState<string>()
    const [request, setRequest] = useState<SpecialistSummonRequest>()
    const [, setRevision] = useState(0)
    // Matches the real parent composer, which restores a destination after its first render.
    useLayoutEffect(() => {
      if (scope === 'new:project-a') setDoc(restoredDoc)
    }, [scope])
    const choose = useSpecialistExample({
      scopeKey: scope,
      selectedId,
      items,
      doc,
      canEdit: true,
      pending: false,
      failed: false,
      select: (id) => {
        selected(id)
        setSelectedId(id)
      },
      changeDoc: setDoc,
      t
    })
    useSpecialistSummon({
      request,
      scopeKey: scope,
      activeSessionId: scope === 'session-a' ? scope : undefined,
      canEdit: true,
      items,
      select: choose,
      consumed
    })
    summon = () => {
      setRequest({
        requestId: 1,
        draftKey: 'new:project-a',
        specialistId: 'literature-review-agent'
      })
      setScope('new:project-a')
    }
    rerender = () => setRevision((current) => current + 1)
    value = docToText(doc)
    binding = selectedId
    return null
  }
  act(() => root.render(<Probe />))
  cleanup.push(() => act(() => root.unmount()))
  return {
    selected,
    consumed,
    summon: async () => {
      await act(async () => {
        summon()
      })
    },
    rerender: () => act(rerender),
    value: () => value,
    binding: () => binding
  }
}

describe('catalog Specialist summon', () => {
  it('waits for the restored new draft, selects once and prefills the actual example', async () => {
    const hook = mount({ nodes: [] })
    expect(hook.selected).not.toHaveBeenCalled()
    await hook.summon()
    expect(hook.binding()).toBe('literature-review-agent')
    expect(hook.value()).toContain('Write a literature review on')
    expect(hook.value()).not.toContain('Outgoing conversation draft')
    hook.rerender()
    expect(hook.selected).toHaveBeenCalledTimes(1)
    expect(hook.consumed).toHaveBeenCalledOnce()
  })

  it('preserves a restored user-edited new draft while selecting the requested Specialist', async () => {
    const hook = mount(textDoc('My edited research question'))
    await hook.summon()
    expect(hook.binding()).toBe('literature-review-agent')
    expect(hook.value()).toBe('My edited research question')
  })

  it('does not bind a Specialist that was disabled before the request was consumed', async () => {
    const hook = mount(textDoc('My research question'), [builtin(undefined, false)])
    await hook.summon()
    expect(hook.selected).not.toHaveBeenCalled()
    expect(hook.value()).toBe('My research question')
    expect(hook.consumed).toHaveBeenCalledWith(1)
  })
})
