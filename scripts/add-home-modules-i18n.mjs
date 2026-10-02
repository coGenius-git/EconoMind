// Phase 6: add home module navigation i18n keys to all 8 locales.
import { readFileSync, writeFileSync } from 'node:fs'

const LOCALES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh-Hans', 'zh-Hant']

const TRANSLATIONS = {
  de: {
    'Workbench modules': 'Arbeitsbereich-Module',
    'Start research': 'Forschung starten',
    'Create a research project': 'Neues Forschungsprojekt anlegen',
    'Literature research': 'Literaturrecherche',
    'Search, screen, and manage literature': 'Literatur suchen, sichten und verwalten',
    'Research analysis': 'Forschungsanalyse',
    'Research design, models, and data analysis': 'Forschungsdesign, Modelle und Datenanalyse',
    'Knowledge base': 'Wissensbasis',
    'My literature, research notes, and methods': 'Meine Literatur, Notizen und Methoden'
  },
  es: {
    'Workbench modules': 'Módulos del banco de trabajo',
    'Start research': 'Iniciar investigación',
    'Create a research project': 'Crear un proyecto de investigación',
    'Literature research': 'Investigación bibliográfica',
    'Search, screen, and manage literature': 'Buscar, cribar y gestionar literatura',
    'Research analysis': 'Análisis de investigación',
    'Research design, models, and data analysis':
      'Diseño de investigación, modelos y análisis de datos',
    'Knowledge base': 'Base de conocimiento',
    'My literature, research notes, and methods': 'Mi literatura, notas de investigación y métodos'
  },
  fr: {
    'Workbench modules': 'Modules du poste de travail',
    'Start research': 'Commencer la recherche',
    'Create a research project': 'Créer un projet de recherche',
    'Literature research': 'Recherche documentaire',
    'Search, screen, and manage literature': 'Rechercher, trier et gérer la littérature',
    'Research analysis': 'Analyse de recherche',
    'Research design, models, and data analysis':
      'Conception de recherche, modèles et analyse de données',
    'Knowledge base': 'Base de connaissances',
    'My literature, research notes, and methods': 'Ma littérature, notes de recherche et méthodes'
  },
  ja: {
    'Workbench modules': 'ワークベンチモジュール',
    'Start research': '研究を始める',
    'Create a research project': '研究プロジェクトを作成',
    'Literature research': '文献調査',
    'Search, screen, and manage literature': '文献の検索・スクリーニング・管理',
    'Research analysis': '研究分析',
    'Research design, models, and data analysis': '研究デザイン、モデル、データ分析',
    'Knowledge base': 'ナレッジベース',
    'My literature, research notes, and methods': '自分の文献、研究ノート、メソッド'
  },
  ko: {
    'Workbench modules': '워크벤치 모듈',
    'Start research': '연구 시작',
    'Create a research project': '연구 프로젝트 만들기',
    'Literature research': '문헌 연구',
    'Search, screen, and manage literature': '문헌 검색·선별·관리',
    'Research analysis': '연구 분석',
    'Research design, models, and data analysis': '연구 설계, 모델, 데이터 분석',
    'Knowledge base': '지식 베이스',
    'My literature, research notes, and methods': '내 문헌, 연구 노트, 메서드'
  },
  ru: {
    'Workbench modules': 'Модули рабочего стола',
    'Start research': 'Начать исследование',
    'Create a research project': 'Создать исследовательский проект',
    'Literature research': 'Литературное исследование',
    'Search, screen, and manage literature': 'Поиск, отбор и управление литературой',
    'Research analysis': 'Анализ исследования',
    'Research design, models, and data analysis': 'Дизайн исследования, модели и анализ данных',
    'Knowledge base': 'База знаний',
    'My literature, research notes, and methods': 'Моя литература, заметки и методы'
  },
  'zh-Hans': {
    'Workbench modules': '工作台模块',
    'Start research': '开始研究',
    'Create a research project': '创建研究项目',
    'Literature research': '文献研究',
    'Search, screen, and manage literature': '文献搜索、筛选与管理',
    'Research analysis': '研究分析',
    'Research design, models, and data analysis': '研究设计、模型与数据分析',
    'Knowledge base': '知识库',
    'My literature, research notes, and methods': '我的文献、研究笔记与方法库'
  },
  'zh-Hant': {
    'Workbench modules': '工作台模組',
    'Start research': '開始研究',
    'Create a research project': '建立研究專案',
    'Literature research': '文獻研究',
    'Search, screen, and manage literature': '文獻搜尋、篩選與管理',
    'Research analysis': '研究分析',
    'Research design, models, and data analysis': '研究設計、模型與資料分析',
    'Knowledge base': '知識庫',
    'My literature, research notes, and methods': '我的文獻、研究筆記與方法庫'
  }
}

for (const locale of LOCALES) {
  const path = `src/shared/i18n/locales/${locale}.json`
  const catalog = JSON.parse(readFileSync(path, 'utf8'))
  for (const [key, value] of Object.entries(TRANSLATIONS[locale])) {
    if (catalog.renderer[key] === undefined) catalog.renderer[key] = value
  }
  writeFileSync(path, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
}
console.log('ok')
