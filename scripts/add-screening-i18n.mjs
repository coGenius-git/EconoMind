// One-shot Phase 3 i18n injection: adds the literature-screening workflow keys to all 8
// translated locales. Non-Chinese locales receive the English source text as the fallback
// translation; zh-Hans/zh-Hant receive reviewed Chinese copy. Existing keys are left untouched.
// Run from the repo root: node scripts/add-screening-i18n.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = join(root, 'src', 'shared', 'i18n', 'locales')

const LOCALES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh-Hans', 'zh-Hant']

const zhHans = {
  'Literature Screening': '文献综述筛选',
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.':
    '运行五步筛选工作流：关键词、来源、导入、分析与筛选表。',
  'Research topic': '研究主题',
  "Enter your research topic, for example 'AI and firm innovation'.":
    '输入研究主题，例如“人工智能与企业创新”。',
  Keywords: '关键词',
  'Add synonyms and related constructs by hand, or let the research assistant expand the topic into a keyword family.':
    '手动添加同义词与相关构念，或让研究助手将主题扩展为关键词族。',
  'No keywords yet.': '暂无关键词。',
  'Add a keyword or synonym': '添加关键词或同义词',
  Add: '添加',
  'Keyword expansion with the assistant': '使用研究助手扩展关键词',
  'The assistant expands the topic into a keyword family in English and Chinese, including synonyms and related constructs, and saves it as an artifact.':
    '研究助手将主题扩展为中英文关键词族，包括同义词和相关构念，并保存为产物。',
  'Generate keywords with the research assistant': '让研究助手生成关键词',
  'Requires a project or collection context': '需要项目或收藏夹上下文',
  'Open a project or select a collection to use the assistant.':
    '打开项目或选择收藏夹以使用研究助手。',
  Sources: '来源',
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.':
    '选择文献检索来源。Crossref 与 OpenAlex 通过文献技能可用；支持时使用 arXiv 与全文检索。',
  Crossref: 'Crossref',
  OpenAlex: 'OpenAlex',
  arXiv: 'arXiv',
  'Full-text finders': '全文检索',
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.':
    'Google Scholar 没有开放 API；Semantic Scholar 可作为自定义连接器添加。',
  Import: '导入',
  'References in scope': '范围内文献',
  'Import references with the Import PDFs or Import references buttons on the library page, then return here.':
    '使用文献库页面上的“导入 PDF”或“导入文献”按钮导入文献，然后返回此处。',
  Refresh: '刷新',
  'Checking the library…': '正在检查文献库…',
  'References in scope for screening': '范围内待筛选的文献',
  'Records with identifiers are preferred so metadata and citation counts can be verified.':
    '优先使用带标识符的记录，以便核验元数据与引用数。',
  Analysis: '分析',
  'Structured analysis': '结构化分析',
  'The assistant reads each record, extracts research question, theory, data source, method, and conclusion into the item structured fields, then scores each paper 0–5.':
    '研究助手阅读每条记录，将研究问题、理论、数据来源、方法与结论提取到条目的结构化字段中，并为每篇论文评 0–5 分。',
  'Send analysis task to the research assistant': '向研究助手发送分析任务',
  'references with a method extracted': '篇文献已提取方法',
  Included: '纳入',
  Uncertain: '待定',
  Excluded: '排除',
  Pending: '待处理',
  'Screening table': '筛选表',
  'Papers are sorted by relevance score. Export the table as Markdown to keep it as an artifact.':
    '论文按相关性评分排序。将表格导出为 Markdown 以保存为产物。',
  'Generate table with the research assistant': '让研究助手生成筛选表',
  'Export Markdown': '导出 Markdown',
  All: '全部',
  'No references in scope yet. Import references to build the screening table.':
    '范围内暂无文献。请先导入文献以构建筛选表。',
  Paper: '论文',
  Method: '方法',
  Conclusion: '结论',
  Relevance: '相关性',
  'Task prompt for the assistant': '发送给研究助手的任务提示',
  Reset: '重置',
  Next: '下一步',
  Done: '完成',
  'Research question': '研究问题',
  Screening: '筛选状态'
}

const zhHant = {
  'Literature Screening': '文獻綜述篩選',
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.':
    '運行五步篩選工作流：關鍵詞、來源、匯入、分析與篩選表。',
  'Research topic': '研究主題',
  "Enter your research topic, for example 'AI and firm innovation'.":
    '輸入研究主題，例如「人工智能與企業創新」。',
  Keywords: '關鍵詞',
  'Add synonyms and related constructs by hand, or let the research assistant expand the topic into a keyword family.':
    '手動新增同義詞與相關構念，或讓研究助手將主題擴展為關鍵詞族。',
  'No keywords yet.': '暫無關鍵詞。',
  'Add a keyword or synonym': '新增關鍵詞或同義詞',
  Add: '新增',
  'Keyword expansion with the assistant': '使用研究助手擴展關鍵詞',
  'The assistant expands the topic into a keyword family in English and Chinese, including synonyms and related constructs, and saves it as an artifact.':
    '研究助手將主題擴展為中英文關鍵詞族，包括同義詞和相關構念，並儲存為產物。',
  'Generate keywords with the research assistant': '讓研究助手生成關鍵詞',
  'Requires a project or collection context': '需要專案或收藏夾上下文',
  'Open a project or select a collection to use the assistant.':
    '開啟專案或選擇收藏夾以使用研究助手。',
  Sources: '來源',
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.':
    '選擇文獻檢索來源。Crossref 與 OpenAlex 透過文獻技能可用；支援時使用 arXiv 與全文檢索。',
  Crossref: 'Crossref',
  OpenAlex: 'OpenAlex',
  arXiv: 'arXiv',
  'Full-text finders': '全文檢索',
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.':
    'Google Scholar 沒有開放 API；Semantic Scholar 可作為自訂連接器新增。',
  Import: '匯入',
  'References in scope': '範圍內文獻',
  'Import references with the Import PDFs or Import references buttons on the library page, then return here.':
    '使用文獻庫頁面上的「匯入 PDF」或「匯入文獻」按鈕匯入文獻，然後返回此處。',
  Refresh: '重新整理',
  'Checking the library…': '正在檢查文獻庫…',
  'References in scope for screening': '範圍內待篩選的文獻',
  'Records with identifiers are preferred so metadata and citation counts can be verified.':
    '優先使用帶識別碼的記錄，以便核對中繼資料與引用數。',
  Analysis: '分析',
  'Structured analysis': '結構化分析',
  'The assistant reads each record, extracts research question, theory, data source, method, and conclusion into the item structured fields, then scores each paper 0–5.':
    '研究助手閱讀每條記錄，將研究問題、理論、資料來源、方法與結論提取到項目的結構化欄位中，並為每篇論文評 0–5 分。',
  'Send analysis task to the research assistant': '向研究助手傳送分析任務',
  'references with a method extracted': '篇文獻已提取方法',
  Included: '納入',
  Uncertain: '待定',
  Excluded: '排除',
  Pending: '待處理',
  'Screening table': '篩選表',
  'Papers are sorted by relevance score. Export the table as Markdown to keep it as an artifact.':
    '論文按相關性評分排序。將表格匯出為 Markdown 以儲存為產物。',
  'Generate table with the research assistant': '讓研究助手生成篩選表',
  'Export Markdown': '匯出 Markdown',
  All: '全部',
  'No references in scope yet. Import references to build the screening table.':
    '範圍內暫無文獻。請先匯入文獻以建立篩選表。',
  Paper: '論文',
  Method: '方法',
  Conclusion: '結論',
  Relevance: '相關性',
  'Task prompt for the assistant': '傳送給研究助手的任務提示',
  Reset: '重設',
  Next: '下一步',
  Done: '完成',
  'Research question': '研究問題',
  Screening: '篩選狀態'
}

const translations = {
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

let added = 0
for (const locale of LOCALES) {
  const path = join(localesDir, `${locale}.json`)
  const catalog = JSON.parse(readFileSync(path, 'utf8'))
  const renderer = catalog.renderer ?? {}
  const entries =
    locale === 'zh-Hans' || locale === 'zh-Hant'
      ? translations[locale]
      : Object.fromEntries(Object.keys(zhHans).map((key) => [key, key]))
  for (const [key, value] of Object.entries(entries)) {
    if (key in renderer) continue
    renderer[key] = value
    added += 1
  }
  catalog.renderer = renderer
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`updated ${locale}: renderer keys = ${Object.keys(renderer).length}`)
}
console.log(`injected ${added} translation entries across ${LOCALES.length} locales`)
