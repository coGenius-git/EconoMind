import '@/assets/main.css'
import { createRoot } from 'react-dom/client'
import { initI18n } from '@/i18n'
import { LiteratureLibraryPage } from '@/pages/literature/LiteratureLibraryPage'
import { useProjectStore } from '@/stores/project-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useNavigationStore } from '@/stores/navigation-store'
import { useTagStore } from '@/stores/tag-store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { literatureItemInputSchema } from '../../../src/shared/literature'
import type { LiteratureItemView } from '../../../src/shared/literature'
import type { TagView } from '../../../src/shared/tags'

// Browser-only fixture: production UI, deterministic catalog, no user database or external calls.
const unsubscribe = (): (() => void) => () => undefined
const createdAt = Date.UTC(2026, 8, 15)
const titles = [
  'ESG信息披露与企业融资约束',
  '企业社会责任与资本成本',
  '绿色金融政策与企业投资效率',
  '信息透明度与债务融资'
]
const items: LiteratureItemView[] = titles.map((title, index) => ({
  id: `ui-reference-${index}`,
  metadataRevision: 1,
  createdAt,
  updatedAt: createdAt - index,
  projectIds: [],
  collectionIds: ['ui-collection'],
  attachments: [],
  item: literatureItemInputSchema.parse({
    itemType: 'journalArticle',
    title,
    issuedYear: 2024 - index,
    language: '中文',
    containerTitle: ['经济管理', '会计研究', '金融研究', '南开管理评论'][index],
    creators: [
      {
        nameMode: 'organization',
        literalName: ['陈明，李文', '王芳，张伟', '刘洋，赵静', '周宁，黄磊'][index],
        creatorType: 'author'
      }
    ],
    abstract:
      '本条目是界面测试用的虚构文献，不可作为真实引用。研究围绕企业信息披露、融资约束与资本配置展开，展示研究背景、变量设置及主要讨论。文献详情与列表共用当前检索结果；切换条目后可以浏览摘要和标签，再进入完整元数据编辑器。',
    typeFields: { volume: '46', issue: '3', pages: '102–118' }
  })
}))
const collections = [
  {
    id: 'ui-collection',
    name: 'ESG与企业融资',
    description: '检索、筛选并整理研究文献。',
    itemCount: 4,
    createdAt,
    updatedAt: createdAt
  }
]
const tags: TagView[] = [
  { id: 'tag-favorite', systemKey: 'favorite' as const, createdAt, updatedAt: createdAt },
  {
    id: 'ui-tag',
    name: '融资约束',
    iconKey: 'tag',
    colorKey: 'gray',
    createdAt,
    updatedAt: createdAt
  }
]
let assignments = [
  { tagId: 'ui-tag', resourceType: 'literature.item' as const, resourceId: items[0].id, createdAt }
]
const snapshot = (): { revision: number; tags: typeof tags; assignments: typeof assignments } => ({
  revision: 1,
  tags,
  assignments
})
const nativeApi = {
  platform: 'win32',
  window: { onCloseConfirmRequest: unsubscribe },
  projectFiles: { onChanged: unsubscribe },
  literature: {
    onChanged: unsubscribe,
    search: async (request: Record<string, unknown>) => {
      if (request.scope === 'collections') return { entries: collections }
      if (request.scope !== 'library') return { entries: [], totalCount: 0 }
      let matches = items.filter(
        (entry) => !request.query || entry.item.title.includes(String(request.query))
      )
      if (request.hasFullText === true) matches = []
      if (request.sortBy === 'title')
        matches = [...matches].sort((a, b) => a.item.title.localeCompare(b.item.title))
      if (request.sortBy === 'year')
        matches = [...matches].sort((a, b) => (b.item.issuedYear ?? 0) - (a.item.issuedYear ?? 0))
      if (request.sortDirection === 'asc' && request.sortBy !== 'title') matches.reverse()
      if (request.allItemIds)
        return {
          entries: [],
          itemIds: matches.map((entry) => entry.id),
          totalCount: matches.length
        }
      return { entries: matches, totalCount: matches.length }
    },
    jobs: async () => ({ jobs: [], summaries: [] }),
    sources: async () => [],
    get: async (id: string) => items.find((entry) => entry.id === id),
    citationStyles: async () => ({ styles: [] })
  },
  tags: {
    snapshot: async () => snapshot(),
    onChanged: unsubscribe,
    setAssignment: async (request: { tagId: string; resourceId: string; assigned: boolean }) => {
      assignments = assignments.filter(
        (entry) => entry.tagId !== request.tagId || entry.resourceId !== request.resourceId
      )
      if (request.assigned)
        assignments.push({
          tagId: request.tagId,
          resourceType: 'literature.item',
          resourceId: request.resourceId,
          createdAt
        })
      return snapshot()
    }
  }
}
window.api = nativeApi as unknown as typeof window.api
initI18n('zh-Hans')
useSettingsStore.setState({
  isLoaded: true,
  onboardingCompletedAt: 1,
  load: async () => true
})
useProjectStore.setState({ isLoaded: true, projects: [], loadProjects: async () => undefined })
useTagStore.setState({
  ...snapshot(),
  status: 'ready',
  load: async () => undefined,
  listen: unsubscribe
})
useNavigationStore.setState({ view: 'library', pendingLiteratureCollectionId: 'ui-collection' })

createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <LiteratureLibraryPage />
  </TooltipProvider>
)
