// Phase 3 i18n: reviewed translations for the literature-screening workflow across all six
// non-Chinese locales. Only missing keys are written; existing translations are never overwritten.
// Run from repo root: node scripts/add-screening-i18n-translations.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = join(root, 'src', 'shared', 'i18n', 'locales')

const de = {
  'Literature Screening': 'Literatur-Screening',
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.':
    'Führen Sie einen fünfstufigen Screening-Workflow aus: Schlüsselwörter, Quellen, Import, Analyse und die Screening-Tabelle.',
  'Research topic': 'Forschungsthema',
  "Enter your research topic, for example 'AI and firm innovation'.":
    'Geben Sie Ihr Forschungsthema ein, z. B. „KI und Unternehmensinnovation“.',
  Keywords: 'Schlüsselwörter',
  'Add synonyms and related constructs by hand, or let the research assistant expand the topic into a keyword family.':
    'Fügen Sie Synonyme und verwandte Konstrukte manuell hinzu oder lassen Sie den Forschungsassistenten das Thema zu einer Schlüsselwortfamilie erweitern.',
  'No keywords yet.': 'Noch keine Schlüsselwörter.',
  'Add a keyword or synonym': 'Schlüsselwort oder Synonym hinzufügen',
  Add: 'Hinzufügen',
  'Keyword expansion with the assistant': 'Schlüsselwort-Erweiterung mit dem Assistenten',
  'The assistant expands the topic into a keyword family in English and Chinese, including synonyms and related constructs, and saves it as an artifact.':
    'Der Assistent erweitert das Thema zu einer Schlüsselwortfamilie auf Englisch und Chinesisch, einschließlich Synonymen und verwandter Konstrukte, und speichert sie als Artefakt.',
  'Generate keywords with the research assistant':
    'Schlüsselwörter mit dem Forschungsassistenten generieren',
  'Requires a project or collection context': 'Erfordert einen Projekt- oder Sammlungskontext',
  'Open a project or select a collection to use the assistant.':
    'Öffnen Sie ein Projekt oder wählen Sie eine Sammlung, um den Assistenten zu nutzen.',
  Sources: 'Quellen',
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.':
    'Wählen Sie, woher die Einträge abgerufen werden. Crossref und OpenAlex sind über die Literaturfähigkeit verfügbar; arXiv und Volltext-Finder werden verwendet, wo dies unterstützt wird.',
  Crossref: 'Crossref',
  OpenAlex: 'OpenAlex',
  arXiv: 'arXiv',
  'Full-text finders': 'Volltext-Finder',
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.':
    'Google Scholar hat keine offene API; Semantic Scholar kann als benutzerdefinierter Konnektor hinzugefügt werden.',
  Import: 'Importieren',
  'References in scope': 'Referenzen im Umfang',
  'Import references with the Import PDFs or Import references buttons on the library page, then return here.':
    'Importieren Sie Referenzen mit den Schaltflächen „PDFs importieren“ oder „Referenzen importieren“ auf der Bibliotheksseite und kehren Sie dann hierher zurück.',
  Refresh: 'Aktualisieren',
  'Checking the library…': 'Bibliothek wird geprüft…',
  'References in scope for screening': 'Referenzen im Umfang für das Screening',
  'Records with identifiers are preferred so metadata and citation counts can be verified.':
    'Einträge mit Kennungen werden bevorzugt, damit Metadaten und Zitierzahlen überprüft werden können.',
  Analysis: 'Analyse',
  'Structured analysis': 'Strukturierte Analyse',
  'The assistant reads each record, extracts research question, theory, data source, method, and conclusion into the item structured fields, then scores each paper 0–5.':
    'Der Assistent liest jeden Eintrag, extrahiert Forschungsfrage, Theorie, Datenquelle, Methode und Fazit in die strukturierten Felder des Eintrags und bewertet dann jede Arbeit mit 0–5 Punkten.',
  'Send analysis task to the research assistant':
    'Analyseaufgabe an den Forschungsassistenten senden',
  'references with a method extracted': 'Referenzen mit extrahierter Methode',
  Included: 'Eingeschlossen',
  Uncertain: 'Unklar',
  Excluded: 'Ausgeschlossen',
  Pending: 'Ausstehend',
  'Screening table': 'Screening-Tabelle',
  'Papers are sorted by relevance score. Export the table as Markdown to keep it as an artifact.':
    'Die Arbeiten werden nach Relevanzwert sortiert. Exportieren Sie die Tabelle als Markdown, um sie als Artefakt zu speichern.',
  'Generate table with the research assistant': 'Tabelle mit dem Forschungsassistenten generieren',
  'Export Markdown': 'Markdown exportieren',
  All: 'Alle',
  'No references in scope yet. Import references to build the screening table.':
    'Noch keine Referenzen im Umfang. Importieren Sie Referenzen, um die Screening-Tabelle zu erstellen.',
  Paper: 'Arbeit',
  Method: 'Methode',
  Conclusion: 'Fazit',
  Relevance: 'Relevanz',
  'Task prompt for the assistant': 'Aufgaben-Prompt für den Assistenten',
  Reset: 'Zurücksetzen',
  Next: 'Weiter',
  Done: 'Fertig',
  'Research question': 'Forschungsfrage',
  Screening: 'Screening',
  'e.g. Impact of digital transformation on firm innovation':
    'z. B. Auswirkung der digitalen Transformation auf Unternehmensinnovation'
}

const es = {
  'Literature Screening': 'Selección de literatura',
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.':
    'Ejecute un flujo de selección en cinco pasos: palabras clave, fuentes, importación, análisis y la tabla de selección.',
  'Research topic': 'Tema de investigación',
  "Enter your research topic, for example 'AI and firm innovation'.":
    'Introduzca su tema de investigación, por ejemplo «IA e innovación empresarial».',
  Keywords: 'Palabras clave',
  'Add synonyms and related constructs by hand, or let the research assistant expand the topic into a keyword family.':
    'Añada sinónimos y constructos relacionados manualmente, o deje que el asistente de investigación amplíe el tema a una familia de palabras clave.',
  'No keywords yet.': 'Aún no hay palabras clave.',
  'Add a keyword or synonym': 'Añadir una palabra clave o sinónimo',
  Add: 'Añadir',
  'Keyword expansion with the assistant': 'Ampliación de palabras clave con el asistente',
  'The assistant expands the topic into a keyword family in English and Chinese, including synonyms and related constructs, and saves it as an artifact.':
    'El asistente amplía el tema a una familia de palabras clave en inglés y chino, incluidos sinónimos y constructos relacionados, y la guarda como artefacto.',
  'Generate keywords with the research assistant':
    'Generar palabras clave con el asistente de investigación',
  'Requires a project or collection context': 'Requiere un contexto de proyecto o colección',
  'Open a project or select a collection to use the assistant.':
    'Abra un proyecto o seleccione una colección para usar el asistente.',
  Sources: 'Fuentes',
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.':
    'Elija de dónde se obtienen los registros. Crossref y OpenAlex están disponibles a través de la capacidad de literatura; arXiv y los buscadores de texto completo se usan donde se admiten.',
  Crossref: 'Crossref',
  OpenAlex: 'OpenAlex',
  arXiv: 'arXiv',
  'Full-text finders': 'Buscadores de texto completo',
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.':
    'Google Scholar no tiene API abierta; Semantic Scholar puede añadirse como conector personalizado.',
  Import: 'Importar',
  'References in scope': 'Referencias en el ámbito',
  'Import references with the Import PDFs or Import references buttons on the library page, then return here.':
    'Importe referencias con los botones «Importar PDF» o «Importar referencias» de la página de biblioteca y vuelva aquí.',
  Refresh: 'Actualizar',
  'Checking the library…': 'Comprobando la biblioteca…',
  'References in scope for screening': 'Referencias en el ámbito para la selección',
  'Records with identifiers are preferred so metadata and citation counts can be verified.':
    'Se prefieren los registros con identificadores para poder verificar metadatos y recuentos de citas.',
  Analysis: 'Análisis',
  'Structured analysis': 'Análisis estructurado',
  'The assistant reads each record, extracts research question, theory, data source, method, and conclusion into the item structured fields, then scores each paper 0–5.':
    'El asistente lee cada registro, extrae la pregunta de investigación, la teoría, la fuente de datos, el método y la conclusión en los campos estructurados del elemento y luego puntúa cada artículo de 0 a 5.',
  'Send analysis task to the research assistant':
    'Enviar la tarea de análisis al asistente de investigación',
  'references with a method extracted': 'referencias con método extraído',
  Included: 'Incluido',
  Uncertain: 'Incierto',
  Excluded: 'Excluido',
  Pending: 'Pendiente',
  'Screening table': 'Tabla de selección',
  'Papers are sorted by relevance score. Export the table as Markdown to keep it as an artifact.':
    'Los artículos se ordenan por puntuación de relevancia. Exporte la tabla como Markdown para conservarla como artefacto.',
  'Generate table with the research assistant':
    'Generar la tabla con el asistente de investigación',
  'Export Markdown': 'Exportar Markdown',
  All: 'Todos',
  'No references in scope yet. Import references to build the screening table.':
    'Aún no hay referencias en el ámbito. Importe referencias para crear la tabla de selección.',
  Paper: 'Artículo',
  Method: 'Método',
  Conclusion: 'Conclusión',
  Relevance: 'Relevancia',
  'Task prompt for the assistant': 'Prompt de la tarea para el asistente',
  Reset: 'Restablecer',
  Next: 'Siguiente',
  Done: 'Listo',
  'Research question': 'Pregunta de investigación',
  Screening: 'Selección',
  'e.g. Impact of digital transformation on firm innovation':
    'p. ej. impacto de la transformación digital en la innovación empresarial'
}

const fr = {
  'Literature Screening': 'Sélection de la littérature',
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.':
    'Exécutez un flux de sélection en cinq étapes : mots-clés, sources, importation, analyse et le tableau de sélection.',
  'Research topic': 'Sujet de recherche',
  "Enter your research topic, for example 'AI and firm innovation'.":
    'Saisissez votre sujet de recherche, par exemple « IA et innovation des entreprises ».',
  Keywords: 'Mots-clés',
  'Add synonyms and related constructs by hand, or let the research assistant expand the topic into a keyword family.':
    "Ajoutez des synonymes et des concepts associés manuellement, ou laissez l'assistant de recherche développer le sujet en famille de mots-clés.",
  'No keywords yet.': 'Aucun mot-clé pour le moment.',
  'Add a keyword or synonym': 'Ajouter un mot-clé ou un synonyme',
  Add: 'Ajouter',
  'Keyword expansion with the assistant': "Expansion des mots-clés avec l'assistant",
  'The assistant expands the topic into a keyword family in English and Chinese, including synonyms and related constructs, and saves it as an artifact.':
    "L'assistant développe le sujet en famille de mots-clés en anglais et en chinois, y compris les synonymes et les concepts associés, et l'enregistre comme artefact.",
  'Generate keywords with the research assistant':
    "Générer des mots-clés avec l'assistant de recherche",
  'Requires a project or collection context': 'Nécessite un contexte de projet ou de collection',
  'Open a project or select a collection to use the assistant.':
    "Ouvrez un projet ou sélectionnez une collection pour utiliser l'assistant.",
  Sources: 'Sources',
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.':
    "Choisissez d'où proviennent les enregistrements. Crossref et OpenAlex sont disponibles via la compétence littérature ; arXiv et les moteurs de texte intégral sont utilisés lorsque c'est pris en charge.",
  Crossref: 'Crossref',
  OpenAlex: 'OpenAlex',
  arXiv: 'arXiv',
  'Full-text finders': 'Moteurs de texte intégral',
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.':
    "Google Scholar n'a pas d'API ouverte ; Semantic Scholar peut être ajouté comme connecteur personnalisé.",
  Import: 'Importer',
  'References in scope': 'Références dans le périmètre',
  'Import references with the Import PDFs or Import references buttons on the library page, then return here.':
    'Importez les références avec les boutons « Importer des PDF » ou « Importer des références » de la page bibliothèque, puis revenez ici.',
  Refresh: 'Actualiser',
  'Checking the library…': 'Vérification de la bibliothèque…',
  'References in scope for screening': 'Références dans le périmètre pour la sélection',
  'Records with identifiers are preferred so metadata and citation counts can be verified.':
    'Les enregistrements avec identifiants sont préférés afin que les métadonnées et les nombres de citations puissent être vérifiés.',
  Analysis: 'Analyse',
  'Structured analysis': 'Analyse structurée',
  'The assistant reads each record, extracts research question, theory, data source, method, and conclusion into the item structured fields, then scores each paper 0–5.':
    "L'assistant lit chaque enregistrement, extrait la question de recherche, la théorie, la source de données, la méthode et la conclusion dans les champs structurés de l'élément, puis note chaque article de 0 à 5.",
  'Send analysis task to the research assistant':
    "Envoyer la tâche d'analyse à l'assistant de recherche",
  'references with a method extracted': 'références avec méthode extraite',
  Included: 'Inclus',
  Uncertain: 'Incertain',
  Excluded: 'Exclu',
  Pending: 'En attente',
  'Screening table': 'Tableau de sélection',
  'Papers are sorted by relevance score. Export the table as Markdown to keep it as an artifact.':
    'Les articles sont triés par score de pertinence. Exportez le tableau au format Markdown pour le conserver comme artefact.',
  'Generate table with the research assistant': "Générer le tableau avec l'assistant de recherche",
  'Export Markdown': 'Exporter en Markdown',
  All: 'Tous',
  'No references in scope yet. Import references to build the screening table.':
    'Aucune référence dans le périmètre pour le moment. Importez des références pour construire le tableau de sélection.',
  Paper: 'Article',
  Method: 'Méthode',
  Conclusion: 'Conclusion',
  Relevance: 'Pertinence',
  'Task prompt for the assistant': "Prompt de la tâche pour l'assistant",
  Reset: 'Réinitialiser',
  Next: 'Suivant',
  Done: 'Terminé',
  'Research question': 'Question de recherche',
  Screening: 'Sélection',
  'e.g. Impact of digital transformation on firm innovation':
    "par ex. impact de la transformation numérique sur l'innovation des entreprises"
}

const ja = {
  'Literature Screening': '文献スクリーニング',
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.':
    'キーワード、ソース、インポート、分析、スクリーニング表の5段階のスクリーニングワークフローを実行します。',
  'Research topic': '研究テーマ',
  "Enter your research topic, for example 'AI and firm innovation'.":
    '研究テーマを入力してください（例：「AIと企業イノベーション」）。',
  Keywords: 'キーワード',
  'Add synonyms and related constructs by hand, or let the research assistant expand the topic into a keyword family.':
    '同義語や関連する構成概念を手動で追加するか、研究アシスタントにテーマをキーワードファミリーへ拡張させます。',
  'No keywords yet.': 'キーワードはまだありません。',
  'Add a keyword or synonym': 'キーワードまたは同義語を追加',
  Add: '追加',
  'Keyword expansion with the assistant': 'アシスタントによるキーワード拡張',
  'The assistant expands the topic into a keyword family in English and Chinese, including synonyms and related constructs, and saves it as an artifact.':
    'アシスタントは、同義語や関連する構成概念を含めてテーマを英語・中国語のキーワードファミリーに拡張し、成果物として保存します。',
  'Generate keywords with the research assistant': '研究アシスタントでキーワードを生成',
  'Requires a project or collection context':
    'プロジェクトまたはコレクションのコンテキストが必要です',
  'Open a project or select a collection to use the assistant.':
    'アシスタントを使用するには、プロジェクトを開くかコレクションを選択してください。',
  Sources: 'ソース',
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.':
    'レコードの取得元を選択してください。CrossrefとOpenAlexは文献スキルから利用でき、arXivと全文検索はサポートされている場合に使用されます。',
  Crossref: 'Crossref',
  OpenAlex: 'OpenAlex',
  arXiv: 'arXiv',
  'Full-text finders': '全文検索',
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.':
    'Google ScholarにはオープンAPIがありません。Semantic Scholarはカスタムコネクタとして追加できます。',
  Import: 'インポート',
  'References in scope': '対象範囲の参考文献',
  'Import references with the Import PDFs or Import references buttons on the library page, then return here.':
    'ライブラリページの「PDFをインポート」または「参考文献をインポート」ボタンで参考文献をインポートしてから、ここに戻ってください。',
  Refresh: '更新',
  'Checking the library…': 'ライブラリを確認中…',
  'References in scope for screening': 'スクリーニング対象の参考文献',
  'Records with identifiers are preferred so metadata and citation counts can be verified.':
    'メタデータと引用数を検証できるよう、識別子を持つレコードを優先します。',
  Analysis: '分析',
  'Structured analysis': '構造化分析',
  'The assistant reads each record, extracts research question, theory, data source, method, and conclusion into the item structured fields, then scores each paper 0–5.':
    'アシスタントは各レコードを読み、研究質問、理論、データソース、方法、結論を項目の構造化フィールドに抽出し、各論文を0〜5点で評価します。',
  'Send analysis task to the research assistant': '研究アシスタントに分析タスクを送信',
  'references with a method extracted': '件の参考文献から方法を抽出しました',
  Included: '含む',
  Uncertain: '不明',
  Excluded: '除外',
  Pending: '保留',
  'Screening table': 'スクリーニング表',
  'Papers are sorted by relevance score. Export the table as Markdown to keep it as an artifact.':
    '論文は関連性スコア順に並んでいます。テーブルをMarkdownとしてエクスポートして成果物として保存できます。',
  'Generate table with the research assistant': '研究アシスタントで表を生成',
  'Export Markdown': 'Markdownをエクスポート',
  All: 'すべて',
  'No references in scope yet. Import references to build the screening table.':
    '対象範囲に参考文献がまだありません。スクリーニング表を作成するには参考文献をインポートしてください。',
  Paper: '論文',
  Method: '方法',
  Conclusion: '結論',
  Relevance: '関連性',
  'Task prompt for the assistant': 'アシスタントへのタスクプロンプト',
  Reset: 'リセット',
  Next: '次へ',
  Done: '完了',
  'Research question': '研究質問',
  Screening: 'スクリーニング',
  'e.g. Impact of digital transformation on firm innovation':
    '例：企業イノベーションに対するデジタルトランスフォーメーションの影響'
}

const ko = {
  'Literature Screening': '문헌 스크리닝',
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.':
    '키워드, 출처, 가져오기, 분석, 스크리닝 표의 5단계 스크리닝 워크플로를 실행합니다.',
  'Research topic': '연구 주제',
  "Enter your research topic, for example 'AI and firm innovation'.":
    "'AI와 기업 혁신'과 같이 연구 주제를 입력하세요.",
  Keywords: '키워드',
  'Add synonyms and related constructs by hand, or let the research assistant expand the topic into a keyword family.':
    '동의어와 관련 구성 개념을 직접 추가하거나, 연구 어시스턴트가 주제를 키워드 계열로 확장하도록 하세요.',
  'No keywords yet.': '아직 키워드가 없습니다.',
  'Add a keyword or synonym': '키워드 또는 동의어 추가',
  Add: '추가',
  'Keyword expansion with the assistant': '어시스턴트로 키워드 확장',
  'The assistant expands the topic into a keyword family in English and Chinese, including synonyms and related constructs, and saves it as an artifact.':
    '어시스턴트는 동의어와 관련 구성 개념을 포함해 주제를 영어와 중국어 키워드 계열로 확장하고 이를 아티팩트로 저장합니다.',
  'Generate keywords with the research assistant': '연구 어시스턴트로 키워드 생성',
  'Requires a project or collection context': '프로젝트 또는 컬렉션 컨텍스트 필요',
  'Open a project or select a collection to use the assistant.':
    '어시스턴트를 사용하려면 프로젝트를 열거나 컬렉션을 선택하세요.',
  Sources: '출처',
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.':
    '레코드를 가져올 출처를 선택하세요. Crossref와 OpenAlex는 문헌 스킬로 사용할 수 있으며, 지원되는 곳에서는 arXiv와 전문 검색을 사용합니다.',
  Crossref: 'Crossref',
  OpenAlex: 'OpenAlex',
  arXiv: 'arXiv',
  'Full-text finders': '전문 검색',
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.':
    'Google Scholar에는 공개 API가 없습니다. Semantic Scholar는 사용자 지정 커넥터로 추가할 수 있습니다.',
  Import: '가져오기',
  'References in scope': '범위 내 참고문헌',
  'Import references with the Import PDFs or Import references buttons on the library page, then return here.':
    '라이브러리 페이지의 "PDF 가져오기" 또는 "참고문헌 가져오기" 버튼으로 참고문헌을 가져온 후 여기로 돌아오세요.',
  Refresh: '새로고침',
  'Checking the library…': '라이브러리를 확인하는 중…',
  'References in scope for screening': '스크리닝할 범위 내 참고문헌',
  'Records with identifiers are preferred so metadata and citation counts can be verified.':
    '메타데이터와 인용 수를 검증할 수 있도록 식별자가 있는 레코드를 선호합니다.',
  Analysis: '분석',
  'Structured analysis': '구조화 분석',
  'The assistant reads each record, extracts research question, theory, data source, method, and conclusion into the item structured fields, then scores each paper 0–5.':
    '어시스턴트는 각 레코드를 읽고 연구 질문, 이론, 데이터 출처, 방법, 결론을 항목의 구조화 필드에 추출한 다음 각 논문을 0–5점으로 평가합니다.',
  'Send analysis task to the research assistant': '연구 어시스턴트에게 분석 작업 보내기',
  'references with a method extracted': '방법이 추출된 참고문헌',
  Included: '포함됨',
  Uncertain: '불확실함',
  Excluded: '제외됨',
  Pending: '대기 중',
  'Screening table': '스크리닝 표',
  'Papers are sorted by relevance score. Export the table as Markdown to keep it as an artifact.':
    '논문은 관련성 점수 순으로 정렬됩니다. 표를 Markdown으로 내보내 아티팩트로 보관하세요.',
  'Generate table with the research assistant': '연구 어시스턴트로 표 생성',
  'Export Markdown': 'Markdown 내보내기',
  All: '전체',
  'No references in scope yet. Import references to build the screening table.':
    '범위 내 참고문헌이 아직 없습니다. 스크리닝 표를 만들려면 참고문헌을 가져오세요.',
  Paper: '논문',
  Method: '방법',
  Conclusion: '결론',
  Relevance: '관련성',
  'Task prompt for the assistant': '어시스턴트용 작업 프롬프트',
  Reset: '재설정',
  Next: '다음',
  Done: '완료',
  'Research question': '연구 질문',
  Screening: '스크리닝',
  'e.g. Impact of digital transformation on firm innovation':
    '예: 기업 혁신에 대한 디지털 전환의 영향'
}

const ru = {
  'Literature Screening': 'Скрининг литературы',
  'Run a five-step screening workflow: keywords, sources, import, analysis, and the screening table.':
    'Выполните пятиэтапный процесс скрининга: ключевые слова, источники, импорт, анализ и таблица скрининга.',
  'Research topic': 'Тема исследования',
  "Enter your research topic, for example 'AI and firm innovation'.":
    'Введите тему исследования, например «ИИ и инновации компаний».',
  Keywords: 'Ключевые слова',
  'Add synonyms and related constructs by hand, or let the research assistant expand the topic into a keyword family.':
    'Добавляйте синонимы и связанные конструкты вручную или позвольте исследовательскому ассистенту расширить тему до семейства ключевых слов.',
  'No keywords yet.': 'Пока нет ключевых слов.',
  'Add a keyword or synonym': 'Добавить ключевое слово или синоним',
  Add: 'Добавить',
  'Keyword expansion with the assistant': 'Расширение ключевых слов с ассистентом',
  'The assistant expands the topic into a keyword family in English and Chinese, including synonyms and related constructs, and saves it as an artifact.':
    'Ассистент расширяет тему до семейства ключевых слов на английском и китайском, включая синонимы и связанные конструкты, и сохраняет его как артефакт.',
  'Generate keywords with the research assistant':
    'Сгенерировать ключевые слова с исследовательским ассистентом',
  'Requires a project or collection context': 'Требуется контекст проекта или коллекции',
  'Open a project or select a collection to use the assistant.':
    'Откройте проект или выберите коллекцию, чтобы использовать ассистента.',
  Sources: 'Источники',
  'Choose where records are retrieved from. Crossref and OpenAlex are available through the literature skill; arXiv and full-text finders are used where supported.':
    'Выберите, откуда брать записи. Crossref и OpenAlex доступны через навык работы с литературой; arXiv и поиск по полному тексту используются там, где это поддерживается.',
  Crossref: 'Crossref',
  OpenAlex: 'OpenAlex',
  arXiv: 'arXiv',
  'Full-text finders': 'Поиск по полному тексту',
  'Google Scholar has no open API; Semantic Scholar can be added as a custom connector.':
    'У Google Scholar нет открытого API; Semantic Scholar можно добавить как пользовательский коннектор.',
  Import: 'Импорт',
  'References in scope': 'Ссылки в области охвата',
  'Import references with the Import PDFs or Import references buttons on the library page, then return here.':
    'Импортируйте ссылки кнопками «Импорт PDF» или «Импорт ссылок» на странице библиотеки, затем вернитесь сюда.',
  Refresh: 'Обновить',
  'Checking the library…': 'Проверка библиотеки…',
  'References in scope for screening': 'Ссылки в области охвата для скрининга',
  'Records with identifiers are preferred so metadata and citation counts can be verified.':
    'Предпочтительны записи с идентификаторами, чтобы можно было проверить метаданные и число цитирований.',
  Analysis: 'Анализ',
  'Structured analysis': 'Структурированный анализ',
  'The assistant reads each record, extracts research question, theory, data source, method, and conclusion into the item structured fields, then scores each paper 0–5.':
    'Ассистент читает каждую запись, извлекает исследовательский вопрос, теорию, источник данных, метод и вывод в структурированные поля элемента, затем оценивает каждую статью от 0 до 5.',
  'Send analysis task to the research assistant':
    'Отправить задачу анализа исследовательскому ассистенту',
  'references with a method extracted': 'ссылок с извлечённым методом',
  Included: 'Включено',
  Uncertain: 'Неопределённо',
  Excluded: 'Исключено',
  Pending: 'Ожидает',
  'Screening table': 'Таблица скрининга',
  'Papers are sorted by relevance score. Export the table as Markdown to keep it as an artifact.':
    'Статьи отсортированы по оценке релевантности. Экспортируйте таблицу в Markdown, чтобы сохранить её как артефакт.',
  'Generate table with the research assistant':
    'Сгенерировать таблицу с исследовательским ассистентом',
  'Export Markdown': 'Экспорт в Markdown',
  All: 'Все',
  'No references in scope yet. Import references to build the screening table.':
    'В области охвата пока нет ссылок. Импортируйте ссылки, чтобы построить таблицу скрининга.',
  Paper: 'Статья',
  Method: 'Метод',
  Conclusion: 'Вывод',
  Relevance: 'Релевантность',
  'Task prompt for the assistant': 'Промпт задачи для ассистента',
  Reset: 'Сбросить',
  Next: 'Далее',
  Done: 'Готово',
  'Research question': 'Исследовательский вопрос',
  Screening: 'Скрининг',
  'e.g. Impact of digital transformation on firm innovation':
    'напр. влияние цифровой трансформации на инновации компаний'
}

const translations = { de, es, fr, ja, ko, ru }

let added = 0
let replaced = 0
for (const [locale, entries] of Object.entries(translations)) {
  const path = join(localesDir, `${locale}.json`)
  const catalog = JSON.parse(readFileSync(path, 'utf8'))
  const renderer = catalog.renderer ?? {}
  for (const [key, value] of Object.entries(entries)) {
    const existing = renderer[key]
    // Never overwrite a genuine reviewed translation; do replace the English-source fallback
    // strings left by the earlier injection pass.
    if (typeof existing === 'string' && existing !== key) continue
    renderer[key] = value
    added += 1
    if (typeof existing === 'string') replaced += 1
  }
  catalog.renderer = renderer
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`updated ${locale}`)
}
console.log(`injected ${added} reviewed translations (${replaced} replaced English fallbacks)`)
