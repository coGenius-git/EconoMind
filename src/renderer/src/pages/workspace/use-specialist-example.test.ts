// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { TFunction } from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpecialistListItem, BuiltinSpecialistEntry } from '../../../../shared/specialist'
import { builtinSpecialistExample } from './builtin-specialist-examples'
import { docToText, type ComposerDoc } from './composer/composer-doc'
import { useSpecialistExample } from './use-specialist-example'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const builtin = (id: string): BuiltinSpecialistEntry =>
  ({ kind: 'builtin', id, enabled: true }) as BuiltinSpecialistEntry
const ids = [
  'literature-agent',
  'literature-review-agent',
  'methodology-agent',
  'data-agent',
  'review-agent'
]
const items = ids.map(builtin)
const t = ((text: string) => text) as TFunction
const textDoc = (text: string): ComposerDoc => ({ nodes: [{ type: 'text', text }] })
type Options = Parameters<typeof useSpecialistExample>[0]
const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()))

type Harness = {
  changed: ReturnType<typeof vi.fn>
  selected: ReturnType<typeof vi.fn>
  choose: (id: string | undefined) => void
  update: (patch: Partial<Options>) => void
  text: () => string
}

const mount = (overrides: Partial<Options> = {}): Harness => {
  const container = document.createElement('div')
  const root = createRoot(container)
  let choose!: ReturnType<typeof useSpecialistExample>
  const changed = vi.fn()
  const selected = vi.fn()
  let options: Options = {
    scopeKey: 'project-a:new-conversation',
    selectedId: undefined,
    items,
    doc: { nodes: [] },
    canEdit: true,
    pending: false,
    failed: false,
    select: selected,
    changeDoc: (doc, caret) => {
      changed(doc, caret)
      options = { ...options, doc }
      render()
    },
    t,
    ...overrides
  }
  const Probe = (): null => {
    choose = useSpecialistExample(options)
    return null
  }
  const render = (): void => root.render(createElement(Probe))
  act(render)
  cleanups.push(() => act(() => root.unmount()))
  return {
    changed,
    selected,
    choose: (id: string | undefined) => act(() => choose(id)),
    update: (patch: Partial<Options>) =>
      act(() => {
        options = { ...options, ...patch }
        render()
      }),
    text: () => docToText(options.doc)
  }
}

describe('explicit Specialist example selection', () => {
  it.each(ids)('fills an editable example after %s is selected, without sending anything', (id) => {
    const hook = mount()
    hook.choose(id)
    expect(hook.selected).toHaveBeenCalledWith(id)
    expect(hook.changed).not.toHaveBeenCalled()
    hook.update({ selectedId: id })
    expect(hook.text()).toBe(builtinSpecialistExample(builtin(id), t))
    expect(hook.changed).toHaveBeenCalledTimes(1)
    expect(hook.changed.mock.calls[0][1]).toEqual({ nodeIndex: 0, offset: hook.text().length })
  })

  it('does not prefill on hydration or a runtime-driven handoff', () => {
    const hook = mount({ selectedId: 'literature-agent' })
    hook.update({ selectedId: 'literature-review-agent' })
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('replaces only an untouched example and clears it when selecting Main Agent', () => {
    const hook = mount()
    hook.choose('literature-agent')
    hook.update({ selectedId: 'literature-agent' })
    hook.choose('literature-review-agent')
    hook.update({ selectedId: 'literature-review-agent' })
    expect(hook.text()).toBe(builtinSpecialistExample(builtin('literature-review-agent'), t))
    hook.choose(undefined)
    hook.update({ selectedId: undefined })
    expect(hook.text()).toBe('')
  })

  it('preserves edited examples across Specialist and Main Agent selections', () => {
    const hook = mount()
    hook.choose('literature-agent')
    hook.update({ selectedId: 'literature-agent' })
    const edited = hook.text().replace('2015', '2020')
    hook.update({ doc: textDoc(edited) })
    hook.choose('literature-review-agent')
    hook.update({ selectedId: 'literature-review-agent' })
    hook.choose(undefined)
    hook.update({ selectedId: undefined })
    expect(hook.text()).toBe(edited)
    expect(hook.changed).toHaveBeenCalledTimes(1)
  })

  it.each(['literature-review-agent', undefined])(
    'replaces a restored untouched example when selecting %s after the panel remounts',
    (id) => {
      const hook = mount({
        selectedId: 'literature-agent',
        doc: textDoc(builtinSpecialistExample(builtin('literature-agent'), t)!)
      })
      hook.choose(id)
      hook.update({ selectedId: id })
      expect(hook.text()).toBe(builtinSpecialistExample(id ? builtin(id) : undefined, t) ?? '')
    }
  )

  it('preserves an edited example restored after navigation', () => {
    const edited = builtinSpecialistExample(builtin('literature-agent'), t)!.replace('2015', '2020')
    const hook = mount({ selectedId: 'literature-agent', doc: textDoc(edited) })
    hook.choose('literature-review-agent')
    hook.update({ selectedId: 'literature-review-agent' })
    expect(hook.text()).toBe(edited)
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('waits for a pending switch and preserves typing during the wait', () => {
    const hook = mount()
    hook.choose('data-agent')
    hook.update({ selectedId: 'data-agent', pending: true })
    expect(hook.changed).not.toHaveBeenCalled()
    hook.update({ doc: textDoc('My own question') })
    hook.update({ pending: false })
    expect(hook.text()).toBe('My own question')
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('prefills when a pending switch finally applies to an unchanged empty draft', () => {
    const hook = mount({ pending: true })
    hook.choose('data-agent')
    hook.update({ selectedId: 'data-agent' })
    expect(hook.changed).not.toHaveBeenCalled()
    hook.update({ pending: false })
    expect(hook.text()).toBe(builtinSpecialistExample(builtin('data-agent'), t))
  })

  it('discards failed selections even if the same ID later appears', () => {
    const hook = mount()
    hook.choose('review-agent')
    hook.update({ failed: true })
    hook.update({ failed: false, selectedId: 'review-agent' })
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('waits through a pending recovery notice until the switch successfully applies', () => {
    const hook = mount()
    hook.choose('literature-review-agent')
    hook.update({ selectedId: 'literature-review-agent', pending: true, failed: true })
    expect(hook.changed).not.toHaveBeenCalled()
    hook.update({ pending: false, failed: false })
    expect(hook.text()).toBe(builtinSpecialistExample(builtin('literature-review-agent'), t))
  })

  it('keeps user edits made while a pending recovery notice is visible', () => {
    const hook = mount()
    hook.choose('literature-review-agent')
    hook.update({ selectedId: 'literature-review-agent', pending: true, failed: true })
    hook.update({ doc: textDoc('My revised question') })
    hook.update({ pending: false, failed: false })
    expect(hook.text()).toBe('My revised question')
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('discards a pending request when its switch settles as a real failure', () => {
    const hook = mount()
    hook.choose('literature-review-agent')
    hook.update({ pending: true, failed: true })
    hook.update({ pending: false })
    hook.update({ failed: false, selectedId: 'literature-review-agent' })
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('waits until an unchanged draft becomes editable after the selected role applies', () => {
    const hook = mount()
    hook.choose('literature-review-agent')
    hook.update({ selectedId: 'literature-review-agent', canEdit: false })
    expect(hook.changed).not.toHaveBeenCalled()
    hook.update({ canEdit: true })
    expect(hook.text()).toBe(builtinSpecialistExample(builtin('literature-review-agent'), t))
  })

  it('does not prefill another conversation or revive a request after navigating back', () => {
    const hook = mount({ pending: true })
    hook.choose('data-agent')
    hook.update({ scopeKey: 'project-b:session-b', selectedId: 'data-agent', pending: false })
    hook.update({ scopeKey: 'project-a:new-conversation' })
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('lets the latest explicit selection own the example', () => {
    const hook = mount()
    hook.choose('literature-agent')
    hook.choose('literature-review-agent')
    hook.update({ selectedId: 'literature-agent', pending: true })
    hook.update({ selectedId: 'literature-review-agent', pending: false })
    expect(hook.text()).toBe(builtinSpecialistExample(builtin('literature-review-agent'), t))
    expect(hook.changed).toHaveBeenCalledTimes(1)
  })

  it('preserves an existing question', () => {
    const hook = mount({ doc: textDoc('Existing question') })
    hook.choose('data-agent')
    hook.update({ selectedId: 'data-agent' })
    expect(hook.text()).toBe('Existing question')
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('preserves rich draft references, including invisible pasted-text anchors', () => {
    const doc: ComposerDoc = {
      nodes: [{ type: 'pasted-text', id: 'paste-1', text: 'Uploaded text' }]
    }
    const hook = mount({ doc })
    hook.choose('data-agent')
    hook.update({ selectedId: 'data-agent' })
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('does not edit a readonly or history-browsing draft', () => {
    const hook = mount({ canEdit: false })
    hook.choose('review-agent')
    hook.update({ selectedId: 'review-agent', canEdit: true })
    expect(hook.changed).not.toHaveBeenCalled()
  })

  it('does not use builtin examples for custom profiles, disabled entries or Reviewer', () => {
    expect(
      builtinSpecialistExample({ ...builtin('data-agent'), kind: 'custom' }, t)
    ).toBeUndefined()
    expect(
      builtinSpecialistExample(
        { ...builtin('data-agent'), enabled: false } as SpecialistListItem,
        t
      )
    ).toBeUndefined()
    expect(builtinSpecialistExample({ kind: 'reviewer', id: 'reviewer' }, t)).toBeUndefined()
    expect(builtinSpecialistExample(builtin('unknown'), t)).toBeUndefined()
  })
})
