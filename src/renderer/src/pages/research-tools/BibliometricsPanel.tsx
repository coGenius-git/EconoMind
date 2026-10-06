/**
 * Bibliometrics panel: reads the literature catalog in scope, computes
 * keyword co-occurrence / clusters / hotspots / trends with the shared
 * `analyzeBibliometrics` function, and renders three ECharts figures
 * (keyword network, keyword clusters, research trends).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { GraphChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTranslation } from 'react-i18next'

import {
  analyzeBibliometrics,
  toBibliometricItem,
  type BibliometricsAnalysis,
  type BibliometricItemInput
} from '../../../../shared/bibliometrics'

echarts.use([
  GraphChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer
])

const BIBLIOMETRICS_PAGE_LIMIT = 100
const BIBLIOMETRICS_MAX_FETCHED = 500

export interface BibliometricsPanelProps {
  open: boolean
  onClose: () => void
  projectId?: string
  collectionId?: string
  scopeName: string
}

function itemInput(entry: unknown): BibliometricItemInput | null {
  if (typeof entry !== 'object' || entry === null) return null
  const item = (entry as { item?: unknown }).item
  if (typeof item !== 'object' || item === null) return null
  const record = item as Record<string, unknown>
  if (typeof record.title !== 'string') return null
  return toBibliometricItem({
    id: typeof record.id === 'string' ? record.id : String(record.title),
    title: record.title,
    year: typeof record.year === 'number' ? record.year : null,
    venue: typeof record.venue === 'string' ? record.venue : null,
    typeFields:
      typeof record.typeFields === 'object' && record.typeFields !== null
        ? (record.typeFields as Record<string, unknown>)
        : null
  })
}

function canvasSupported(): boolean {
  try {
    const probe = document.createElement('canvas')
    return typeof probe.getContext === 'function' && Boolean(probe.getContext('2d'))
  } catch {
    return false
  }
}

export function BibliometricsPanel({
  open,
  onClose,
  projectId,
  collectionId,
  scopeName
}: BibliometricsPanelProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<BibliometricsAnalysis | null>(null)
  const [rendered, setRendered] = useState(false)
  const networkRef = useRef<HTMLDivElement>(null)
  const clusterRef = useRef<HTMLDivElement>(null)
  const trendRef = useRef<HTMLDivElement>(null)
  const instances = useRef<Array<ReturnType<typeof echarts.init>>>([])

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const inputs: BibliometricItemInput[] = []
      let offset = 0
      for (;;) {
        const page = await window.api.literature.search({
          scope: 'library',
          projectId,
          collectionId,
          lifecycle: 'active',
          limit: BIBLIOMETRICS_PAGE_LIMIT,
          offset
        })
        for (const entry of page.entries) {
          const input = itemInput(entry)
          if (input) inputs.push(input)
        }
        if (page.nextOffset === undefined || inputs.length >= BIBLIOMETRICS_MAX_FETCHED) break
        offset = page.nextOffset
      }
      setAnalysis(analyzeBibliometrics(inputs))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [projectId, collectionId])

  useEffect(() => {
    if (!open) return
    // The catalog is an external source; load the scope once when opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [open, reload])

  useEffect(() => {
    // The chart mount effect intentionally reflects analysis state synchronously.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) {
      setRendered(false)
      return
    }

    if (!analysis) {
      setRendered(false)
      return
    }
    const chart = (element: HTMLDivElement | null, option: echarts.EChartsCoreOption): void => {
      if (!element || !canvasSupported()) return
      try {
        const instance = echarts.init(element)
        instances.current.push(instance)
        instance.setOption(option)
      } catch {
        // jsdom / headless environments without canvas fall back to text below.
      }
    }
    const frequencies = analysis.keywordFrequencies
    const topNodes = frequencies.slice(0, 40).map((entry, index) => ({
      name: entry.keyword,
      symbolSize: 6 + Math.min(18, entry.count * 3),
      itemStyle: { color: NETWORK_PALETTE[index % NETWORK_PALETTE.length] },
      value: entry.count
    }))
    const nodeIndex = new Map(topNodes.map((node, index) => [node.name, index]))
    const links = analysis.keywordNetwork
      .filter((edge) => nodeIndex.has(edge.source) && nodeIndex.has(edge.target))
      .map((edge) => ({
        source: nodeIndex.get(edge.source),
        target: nodeIndex.get(edge.target),
        value: edge.weight
      }))
    chart(networkRef.current, {
      tooltip: { trigger: 'item' },
      title: {
        text: t('Keyword co-occurrence network'),
        left: 'center',
        textStyle: { fontSize: 13 }
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          data: topNodes,
          links,
          label: { show: true, fontSize: 10, position: 'right' },
          force: { repulsion: 120, edgeLength: 80 },
          emphasis: { focus: 'adjacency' }
        }
      ]
    })

    const clusterNodes = analysis.clusters.slice(0, 12).flatMap((cluster, clusterIndex) =>
      cluster.keywords.slice(0, 10).map((keyword, keywordIndex) => ({
        name: keyword,
        symbolSize: 8 + Math.min(14, keywordIndex * 2),
        itemStyle: { color: CLUSTER_PALETTE[clusterIndex % CLUSTER_PALETTE.length] },
        category: clusterIndex
      }))
    )
    const clusterIndex = new Map(clusterNodes.map((node, index) => [node.name, index]))
    const clusterLinks = analysis.keywordNetwork
      .filter((edge) => clusterIndex.has(edge.source) && clusterIndex.has(edge.target))
      .map((edge) => ({
        source: clusterIndex.get(edge.source),
        target: clusterIndex.get(edge.target),
        value: edge.weight
      }))
    chart(clusterRef.current, {
      tooltip: { trigger: 'item' },
      title: {
        text: t('Keyword clusters'),
        left: 'center',
        textStyle: { fontSize: 13 }
      },
      legend: {
        bottom: 0,
        data: analysis.clusters.slice(0, 12).map((cluster) => cluster.label),
        textStyle: { fontSize: 10 }
      },
      series: [
        {
          type: 'graph',
          layout: 'circular',
          roam: true,
          data: clusterNodes,
          links: clusterLinks,
          categories: analysis.clusters.slice(0, 12).map((cluster) => ({ name: cluster.label })),
          label: { show: true, fontSize: 9 },
          circular: { rotateLabel: true }
        }
      ]
    })

    const years: number[] = []
    if (analysis.yearRange !== null) {
      for (let year = analysis.yearRange[0]; year <= analysis.yearRange[1]; year++) years.push(year)
    }
    const trendKeywords = [...new Set((analysis.trends ?? []).map((point) => point.keyword))]
    const series = trendKeywords.map((keyword, index) => ({
      name: keyword,
      type: 'line' as const,
      smooth: true,
      data: years.map((year) => {
        const point = (analysis.trends ?? []).find(
          (entry) => entry.year === year && entry.keyword === keyword
        )
        return point ? point.count : 0
      }),
      itemStyle: { color: TREND_PALETTE[index % TREND_PALETTE.length] }
    }))
    chart(trendRef.current, {
      tooltip: { trigger: 'axis' },
      title: { text: t('Research trends'), left: 'center', textStyle: { fontSize: 13 } },
      legend: { bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: 36, right: 16, top: 32, bottom: 44 },
      xAxis: { type: 'category', data: years, name: t('Year') },
      yAxis: { type: 'value', minInterval: 1, name: t('Papers') },
      series
    })

    setRendered(true)
    return () => {
      for (const instance of instances.current) instance.dispose()
      instances.current = []
      setRendered(false)
    }
  }, [analysis, open, t])

  const totalItems = analysis?.totalItems ?? 0
  const clusterCount = analysis?.clusters.length ?? 0
  const keywordCount = analysis?.keywordFrequencies.length ?? 0

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-label={t('Bibliometrics')}
    >
      <div className="research-tool-shell research-glass flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden">
        <div className="research-tool-toolbar flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-serif text-xl font-semibold">{t('Bibliometrics')}</h2>
            <p className="text-xs text-muted-foreground">{scopeName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              onClick={() => void reload()}
            >
              {t('Refresh')}
            </button>
            <button
              type="button"
              className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              onClick={onClose}
            >
              {t('Close')}
            </button>
          </div>
        </div>
        <div className="research-tool-content research-reading-surface min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t('Analyzing the literature library…')}
            </p>
          ) : error ? (
            <p className="text-sm text-destructive">
              {t('Could not analyze the literature library')}: {error}
            </p>
          ) : !analysis ? (
            <p className="text-sm text-muted-foreground">{t('No data')}</p>
          ) : totalItems === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('The library is empty in this scope')}
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label={t('Papers analyzed')} value={totalItems} />
                <StatCard label={t('Keywords')} value={keywordCount} />
                <StatCard label={t('Topic clusters')} value={clusterCount} />
              </div>
              <div ref={networkRef} className="h-80 w-full" data-testid="bibliometrics-network" />
              <div ref={clusterRef} className="h-80 w-full" data-testid="bibliometrics-clusters" />
              <div ref={trendRef} className="h-80 w-full" data-testid="bibliometrics-trends" />
              {!rendered ? (
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Charts are unavailable in this environment; statistics above are still computed.'
                  )}
                </p>
              ) : null}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t('Research hotspots')}</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {analysis.hotspots.slice(0, 6).map((hotspot) => (
                    <div
                      key={hotspot.keyword}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="truncate text-sm">{hotspot.keyword}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {hotspot.totalCount} {t('papers')}
                        {hotspot.growth !== null
                          ? ` · ${hotspot.growth >= 0 ? '+' : ''}${Math.round(hotspot.growth * 100)}%`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

const NETWORK_PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac'
]

const CLUSTER_PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
  '#8cd17d',
  '#86bcb6'
]

const TREND_PALETTE = ['#4e79a7', '#f28e2b', '#e15759', '#59a14f', '#76b7b2', '#edc948']
