// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18next } from '@/i18n'
import { useSpecialistStore } from '@/stores/specialist-store'
import { SpecialistBrowser, type SpecialistBrowserProps } from './SpecialistBrowser'
import { specialistTasks, type BrowsableSpecialist } from './specialist-browser-model'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const initialStore = useSpecialistStore.getState()
const builtin: BrowsableSpecialist = {
  kind: 'builtin',
  readonly: true,
  version: '1.0.0',
  id: 'literature-agent',
  name: 'Literature Agent',
  displayName: 'Literature Search Specialist',
  description: 'Find relevant papers and verify their bibliographic information.',
  systemPrompt:
    'Workflow:\n1. Define the research scope.\n2. Verify source links.\nGeneral rules:\n- Preserve original files.',
  enabled: true,
  capabilityMode: 'selected',
  fullAccess: { excludedSkillIds: [], excludedConnectorIds: [], connectorTools: [] },
  selectedCapabilities: {
    skillIds: ['evidence-search'],
    connectorIds: ['literature'],
    connectorTools: []
  },
  revision: 1
}
const custom: BrowsableSpecialist = {
  ...builtin,
  kind: 'custom',
  id: 'custom-audit',
  name: 'CUSTOM_AUDIT',
  displayName: 'Accounting Auditor',
  description: 'Audit financial records and accounting definitions.',
  systemPrompt: 'Read accounting records and preserve the originals.'
}

let container: HTMLDivElement
let root: Root
let load: ReturnType<typeof vi.fn<typeof initialStore.load>>
let props: SpecialistBrowserProps

beforeEach(async () => {
  await i18next.changeLanguage('en')
  load = vi.fn<typeof initialStore.load>().mockResolvedValue(undefined)
  useSpecialistStore.setState(
    {
      ...initialStore,
      items: [builtin, custom, { kind: 'reviewer', id: 'reviewer' }],
      isLoaded: true,
      loadError: undefined,
      integrity: { status: 'ok' },
      load
    },
    true
  )
  window.api = { specialist: { list: vi.fn() } } as unknown as Window['api']
  props = {
    projectName: 'Research project',
    canSummon: true,
    onSummon: vi.fn(),
    onManage: vi.fn(),
    onBack: vi.fn()
  }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useSpecialistStore.setState(initialStore, true)
  delete (window as unknown as { api?: unknown }).api
})

const renderBrowser = async (): Promise<void> => {
  await act(async () => root.render(<SpecialistBrowser {...props} />))
}
const click = async (element: HTMLElement): Promise<void> => {
  await act(async () => fireEvent.click(element))
}
const card = (id: string): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>(`[data-specialist-id="${id}"]`)!
const summon = (): HTMLButtonElement | null =>
  container.querySelector('[data-testid="specialist-summon"]')

describe('SpecialistBrowser', () => {
  it('browses actual profiles, excludes the reviewer placeholder, and emits only summon intent', async () => {
    await renderBrowser()
    expect(load).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('[data-specialist-id]')).toHaveLength(2)
    expect(container.querySelector('[data-specialist-id="reviewer"]')).toBeNull()
    expect(container.textContent).toContain('Research project')
    expect(container.textContent).toContain('Define the research scope.')
    expect(container.textContent).toContain('I am researching')
    await click(card('custom-audit'))
    const detail = within(
      container.querySelector<HTMLElement>('[data-testid="specialist-browser-detail"]')!
    )
    expect(detail.getByRole('heading', { name: 'Accounting Auditor' })).toBeDefined()
    expect(detail.getByText(custom.systemPrompt)).toBeDefined()
    expect(detail.queryByText('I am researching')).toBeNull()
    await click(summon()!)
    expect(props.onSummon).toHaveBeenCalledExactlyOnceWith('custom-audit')
    await click(within(container).getByRole('button', { name: 'Manage Specialists' }))
    await click(within(container).getByRole('button', { name: 'Back to conversation' }))
    expect(props.onManage).toHaveBeenCalledOnce()
    expect(props.onBack).toHaveBeenCalledOnce()
  })

  it('filters sources and searches names or descriptions without leaving a hidden summon target', async () => {
    await renderBrowser()
    const source = within(container).getByRole('group', { name: 'Specialists' })
    await click(within(source).getByRole('button', { name: 'Custom' }))
    expect(card('literature-agent')).toBeNull()
    expect(card('custom-audit').getAttribute('aria-pressed')).toBe('true')
    await click(summon()!)
    expect(props.onSummon).toHaveBeenLastCalledWith('custom-audit')
    await click(within(source).getByRole('button', { name: 'All' }))
    const search = within(container).getByRole('searchbox', { name: 'Search specialists' })
    await act(async () => fireEvent.change(search, { target: { value: '  bibliographic  ' } }))
    expect(container.querySelectorAll('[data-specialist-id]')).toHaveLength(1)
    expect(card('literature-agent').getAttribute('aria-pressed')).toBe('true')
    await act(async () => fireEvent.change(search, { target: { value: 'no match here' } }))
    expect(container.textContent).toContain('No Specialists match your search.')
    expect(summon()).toBeNull()
    await click(within(container).getByRole('button', { name: 'Clear filters' }))
    expect(container.querySelectorAll('[data-specialist-id]')).toHaveLength(2)
  })

  it('adopts updated and removed profiles while the browser remains mounted', async () => {
    await renderBrowser()
    await click(card('custom-audit'))
    await act(async () =>
      useSpecialistStore.setState({ items: [{ ...custom, enabled: false }, builtin] })
    )
    expect(summon()?.disabled).toBe(true)
    expect(container.textContent).toContain('This Specialist is disabled.')
    await act(async () => useSpecialistStore.setState({ items: [builtin] }))
    expect(summon()?.disabled).toBe(false)
    await click(summon()!)
    expect(props.onSummon).toHaveBeenCalledExactlyOnceWith('literature-agent')
  })

  it('keeps the complete workflow in its reading region and the summon action outside it', async () => {
    const tasks = Array.from(
      { length: 5 },
      (_, index) => `Task ${index + 1}: ${'Read evidence carefully. '.repeat(20)}`
    )
    useSpecialistStore.setState({
      items: [
        { ...builtin, systemPrompt: tasks.map((task, index) => `${index + 1}. ${task}`).join('\n') }
      ]
    })
    await renderBrowser()
    const reading = within(container).getByRole('region', { name: 'Role and tasks' })
    for (const task of tasks) expect(reading.textContent).toContain(task)
    expect(reading.textContent).toContain('I am researching')
    expect(reading.contains(summon())).toBe(false)
    expect(summon()?.disabled).toBe(false)
  })

  it.each([
    [
      'disabled',
      { ...builtin, enabled: false },
      'This Specialist is disabled. Enable it in Manage Specialists.'
    ],
    [
      'pending setup',
      { ...builtin, enabled: false, setupPending: true },
      'This Specialist needs setup. Complete it in Manage Specialists.'
    ]
  ])('shows the specific %s reason and prevents summoning', async (_status, item, reason) => {
    useSpecialistStore.setState({ items: [item] })
    await renderBrowser()
    expect(summon()?.disabled).toBe(true)
    expect(container.textContent).toContain(reason)
    await click(summon()!)
    expect(props.onSummon).not.toHaveBeenCalled()
  })

  it('blocks summoning without a project or Specialist API', async () => {
    props.canSummon = false
    await renderBrowser()
    expect(summon()?.disabled).toBe(true)
    expect(container.textContent).toContain('Open a project to summon a Specialist.')
    props.summonDisabledReason = 'Project hydration in progress'
    await renderBrowser()
    expect(container.textContent).toContain('Project hydration in progress')
    delete (window as unknown as { api?: unknown }).api
    props.canSummon = true
    await renderBrowser()
    expect(summon()?.disabled).toBe(true)
    expect(container.textContent).toContain('Specialists are unavailable here.')
  })

  it('keeps cached profiles blocked throughout a retry, including after a failed request', async () => {
    useSpecialistStore.setState({ loadError: 'Safe load error' })
    await renderBrowser()
    let rejectRetry: (error: Error) => void = () => undefined
    load.mockImplementationOnce(() => {
      useSpecialistStore.setState({ loadError: undefined })
      return new Promise<void>((_resolve, reject) => {
        rejectRetry = reject
      })
    })
    await click(within(container).getByRole('button', { name: 'Retry' }))
    expect(summon()?.disabled).toBe(true)
    expect(container.textContent).toContain('Loading…')
    await act(async () => {
      useSpecialistStore.setState({ loadError: 'Safe load error' })
      rejectRetry(new Error('Failed retry'))
    })
    expect(summon()?.disabled).toBe(true)
    expect(within(container).getByRole('button', { name: 'Retry' })).toBeDefined()
    expect(props.onSummon).not.toHaveBeenCalled()
  })

  it.each(['load failure', 'integrity failure'])(
    'blocks stale catalog summon and forces retry after %s',
    async (failure) => {
      useSpecialistStore.setState(
        failure === 'load failure'
          ? { loadError: 'Safe load error' }
          : {
              integrity: {
                status: 'degraded',
                issues: [{ code: 'record-invalid', recordIndex: 0 }]
              }
            }
      )
      await renderBrowser()
      expect(summon()?.disabled).toBe(true)
      expect(within(container).getByRole('alert')).toBeDefined()
      load.mockImplementationOnce(async () => {
        useSpecialistStore.setState({
          loadError: undefined,
          integrity: { status: 'ok' },
          isLoaded: true
        })
      })
      await click(within(container).getByRole('button', { name: 'Retry' }))
      expect(load).toHaveBeenLastCalledWith({ force: true })
      expect(summon()?.disabled).toBe(false)
      expect(within(container).queryByRole('alert')).toBeNull()
    }
  )

  it('shows initial loading and empty source states', async () => {
    useSpecialistStore.setState({ items: [], isLoaded: false })
    await renderBrowser()
    expect(within(container).getByRole('status').textContent).toContain('Loading…')
    expect(summon()).toBeNull()
    await act(async () => useSpecialistStore.setState({ items: [builtin], isLoaded: true }))
    const source = within(container).getByRole('group', { name: 'Specialists' })
    await click(within(source).getByRole('button', { name: 'Custom' }))
    expect(container.textContent).toContain('No Specialists in this category.')
    expect(summon()).toBeNull()
  })
})

describe('profile task extraction', () => {
  it('uses the first numbered workflow and stops at subsequent policy sections', () => {
    expect(specialistTasks(builtin.systemPrompt)).toEqual([
      'Define the research scope.',
      'Verify source links.'
    ])
    expect(specialistTasks(custom.systemPrompt)).toEqual([])
    expect(
      specialistTasks('工作流程：\n1. 阅读材料。\n2. 核实来源。\n通用执行规则：\n1. 保留原件。')
    ).toEqual(['阅读材料。', '核实来源。'])
  })
})
