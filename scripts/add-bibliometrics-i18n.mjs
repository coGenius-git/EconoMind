// Phase 4: add bibliometrics i18n keys to all 8 locales.
import { readFileSync, writeFileSync } from 'node:fs'

const LOCALES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh-Hans', 'zh-Hant']

const TRANSLATIONS = {
  de: {
    Bibliometrics: 'Bibliometrie',
    'Keyword co-occurrence network': 'Keyword-Ko-Okkurrenz-Netzwerk',
    'Keyword clusters': 'Keyword-Cluster',
    'Research trends': 'Forschungstrends',
    Papers: 'Beiträge',
    'Analyzing the literature library…': 'Literaturbibliothek wird analysiert …',
    'Could not analyze the literature library':
      'Literaturbibliothek konnte nicht analysiert werden',
    'No data': 'Keine Daten',
    'The library is empty in this scope': 'Die Bibliothek ist in diesem Bereich leer',
    'Papers analyzed': 'Analysierte Beiträge',
    'Topic clusters': 'Themen-Cluster',
    'Charts are unavailable in this environment; statistics above are still computed.':
      'Diagramme sind in dieser Umgebung nicht verfügbar; die Statistiken oben wurden trotzdem berechnet.',
    'Research hotspots': 'Forschungsschwerpunkte',
    papers: 'Beiträge'
  },
  es: {
    Bibliometrics: 'Bibliometría',
    'Keyword co-occurrence network': 'Red de co-ocurrencia de palabras clave',
    'Keyword clusters': 'Agrupaciones de palabras clave',
    'Research trends': 'Tendencias de investigación',
    Papers: 'Artículos',
    'Analyzing the literature library…': 'Analizando la biblioteca de literatura…',
    'Could not analyze the literature library': 'No se pudo analizar la biblioteca de literatura',
    'No data': 'Sin datos',
    'The library is empty in this scope': 'La biblioteca está vacía en este ámbito',
    'Papers analyzed': 'Artículos analizados',
    'Topic clusters': 'Agrupaciones temáticas',
    'Charts are unavailable in this environment; statistics above are still computed.':
      'Los gráficos no están disponibles en este entorno; las estadísticas anteriores sí se han calculado.',
    'Research hotspots': 'Temas de investigación',
    papers: 'artículos'
  },
  fr: {
    Bibliometrics: 'Bibliométrie',
    'Keyword co-occurrence network': 'Réseau de co-occurrence des mots-clés',
    'Keyword clusters': 'Regroupements de mots-clés',
    'Research trends': 'Tendances de recherche',
    Papers: 'Articles',
    'Analyzing the literature library…': 'Analyse de la bibliothèque de littérature…',
    'Could not analyze the literature library':
      'Impossible d’analyser la bibliothèque de littérature',
    'No data': 'Aucune donnée',
    'The library is empty in this scope': 'La bibliothèque est vide dans ce périmètre',
    'Papers analyzed': 'Articles analysés',
    'Topic clusters': 'Regroupements thématiques',
    'Charts are unavailable in this environment; statistics above are still computed.':
      'Les graphiques ne sont pas disponibles dans cet environnement ; les statistiques ci-dessus ont tout de même été calculées.',
    'Research hotspots': 'Sujets de recherche',
    papers: 'articles'
  },
  ja: {
    Bibliometrics: '文献計量分析',
    'Keyword co-occurrence network': 'キーワード共起ネットワーク',
    'Keyword clusters': 'キーワードクラスタ',
    'Research trends': '研究トレンド',
    Papers: '論文数',
    'Analyzing the literature library…': '文献ライブラリを分析中…',
    'Could not analyze the literature library': '文献ライブラリを分析できませんでした',
    'No data': 'データなし',
    'The library is empty in this scope': 'この範囲のライブラリは空です',
    'Papers analyzed': '分析した論文',
    'Topic clusters': 'トピッククラスタ',
    'Charts are unavailable in this environment; statistics above are still computed.':
      'この環境ではグラフを表示できません。上記の統計は計算済みです。',
    'Research hotspots': '研究ホットスポット',
    papers: '件'
  },
  ko: {
    Bibliometrics: '서지 계량 분석',
    'Keyword co-occurrence network': '키워드 동시출현 네트워크',
    'Keyword clusters': '키워드 클러스터',
    'Research trends': '연구 동향',
    Papers: '논문 수',
    'Analyzing the literature library…': '문헌 라이브러리를 분석하는 중…',
    'Could not analyze the literature library': '문헌 라이브러리를 분석할 수 없습니다',
    'No data': '데이터 없음',
    'The library is empty in this scope': '이 범위의 라이브러리가 비어 있습니다',
    'Papers analyzed': '분석한 논문',
    'Topic clusters': '주제 클러스터',
    'Charts are unavailable in this environment; statistics above are still computed.':
      '이 환경에서는 차트를 사용할 수 없지만 위 통계는 계산되었습니다.',
    'Research hotspots': '연구 핫스팟',
    papers: '건'
  },
  ru: {
    Bibliometrics: 'Библиометрия',
    'Keyword co-occurrence network': 'Сеть совместной встречаемости ключевых слов',
    'Keyword clusters': 'Кластеры ключевых слов',
    'Research trends': 'Исследовательские тренды',
    Papers: 'Статьи',
    'Analyzing the literature library…': 'Анализ библиотеки литературы…',
    'Could not analyze the literature library': 'Не удалось проанализировать библиотеку литературы',
    'No data': 'Нет данных',
    'The library is empty in this scope': 'Библиотека пуста в этой области',
    'Papers analyzed': 'Проанализировано статей',
    'Topic clusters': 'Тематические кластеры',
    'Charts are unavailable in this environment; statistics above are still computed.':
      'Диаграммы недоступны в этом окружении; статистика выше всё равно рассчитана.',
    'Research hotspots': 'Исследовательские точки роста',
    papers: 'статей'
  },
  'zh-Hans': {
    Bibliometrics: '文献计量',
    'Keyword co-occurrence network': '关键词共现网络',
    'Keyword clusters': '关键词聚类',
    'Research trends': '研究趋势',
    Papers: '论文数',
    'Analyzing the literature library…': '正在分析文献库…',
    'Could not analyze the literature library': '无法分析文献库',
    'No data': '暂无数据',
    'The library is empty in this scope': '当前范围文献库为空',
    'Papers analyzed': '分析文献',
    'Topic clusters': '主题聚类',
    'Charts are unavailable in this environment; statistics above are still computed.':
      '当前环境无法渲染图表，上方统计仍已计算。',
    'Research hotspots': '研究热点',
    papers: '篇'
  },
  'zh-Hant': {
    Bibliometrics: '文獻計量',
    'Keyword co-occurrence network': '關鍵詞共現網絡',
    'Keyword clusters': '關鍵詞聚類',
    'Research trends': '研究趨勢',
    Papers: '論文數',
    'Analyzing the literature library…': '正在分析文獻庫…',
    'Could not analyze the literature library': '無法分析文獻庫',
    'No data': '暫無資料',
    'The library is empty in this scope': '目前範圍文獻庫為空',
    'Papers analyzed': '分析文獻',
    'Topic clusters': '主題聚類',
    'Charts are unavailable in this environment; statistics above are still computed.':
      '目前環境無法繪製圖表，上方統計仍已計算。',
    'Research hotspots': '研究熱點',
    papers: '篇'
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
