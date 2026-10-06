# 开源文献获取方案核查

核查日期：2026-10-06。范围：项目自身 README、源码、许可证、GitHub 提交记录和官方 API 文档；未安装或运行这些项目，也未据此下载受限全文。以下维护日期采用 GitHub API 返回的默认分支最新提交时间，不能代表项目质量或持续维护承诺。

结论：知网优先参考 Zotero 中文社区的站点适配，继续通过本地浏览器会话获取用户有权限的 PDF；英文全文参考 Paperscraper 的 DOI/出版商解析策略。当前 OpenAlex 的日额度耗尽仍需配置个人 Key 或等待额度恢复，换客户端库不能消除上游限制。本次已独立补充知网 PDF 入口兼容，未引入第三方运行时或复制上游实现。

## 可复用项目比较

| 项目                                                         | 最新提交（UTC）与许可                                                                                                                                                                                                          | 题录能力                                                                              | 实际全文机制                                                                                              | 知网与机构 IP                                                                                    | 对 EconoMind 的价值                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [Paperscraper](https://github.com/jannisborn/paperscraper)   | [2026-09-29，730efe9](https://github.com/jannisborn/paperscraper/commit/730efe915b73967f16738bd7d799082b842bb16b)；[MIT](https://github.com/jannisborn/paperscraper/blob/730efe915b73967f16738bd7d799082b842bb16b/LICENSE)     | PubMed、arXiv、bioRxiv、medRxiv、chemRxiv，并有 Scholar 检索/引用工具                 | DOI 解析到出版商页，读取 `citation_pdf_url`；arXiv 等专门路径；BioC-PMC/eLife/出版商 API 回退可能返回 XML | 已核 README 和 PDF 模块未提供知网登录/机构 IP 适配；普通 HTTP 请求不等于复用用户的知网浏览器会话 | 优先借鉴 DOI 落地页解析和按出版商回退；不宜直接整体接入                        |
| [PyAlex](https://github.com/J535D165/pyalex)                 | [2026-02-23，875c708](https://github.com/J535D165/pyalex/commit/875c708cbb6e449feebc46d2a7a26af8ed8b2fdd)；[MIT](https://github.com/J535D165/pyalex/blob/875c708cbb6e449feebc46d2a7a26af8ed8b2fdd/LICENSE)                     | OpenAlex 查询、筛选、分页、语义检索                                                   | 已有 `Work.pdf` / `Work.tei`，从 OpenAlex 内容服务获取并写入文件                                          | 无已核实的知网浏览器/机构登录模块                                                                | 是 OpenAlex 客户端，不是新的全文来源；替换现有客户端不能消除 OpenAlex 额度限制 |
| [Paperfetcher](https://github.com/paperfetcher/paperfetcher) | [2024-07-13，850bcd6](https://github.com/paperfetcher/paperfetcher/commit/850bcd6a16e28ef2b926566fcca4e8839696ab3d)；[MIT](https://github.com/paperfetcher/paperfetcher/blob/850bcd6a16e28ef2b926566fcca4e8839696ab3d/LICENSE) | 按期刊 ISSN/日期/关键词检索 Crossref；Crossref/COCI 前向与后向引文检索；输出 DOI、RIS | 已核核心模块获取的是题录和引用记录，未提供所需 PDF 下载流程                                               | 无已核实的知网浏览器/机构登录模块                                                                | 可参考文献追溯检索，不能用于替换本次 PDF 获取流程                              |

原候选 `mtdavies/paperfetcher` 未核到可用仓库；这里核查的是项目团队的 `paperfetcher/paperfetcher`，两者不能混称。维护记录来源：[Paperscraper API](https://api.github.com/repos/jannisborn/paperscraper/commits?per_page=1)、[PyAlex API](https://api.github.com/repos/J535D165/pyalex/commits?per_page=1)、[Paperfetcher API](https://api.github.com/repos/paperfetcher/paperfetcher/commits?per_page=1)。

### Paperscraper：有新增解析能力，但 PDF 与 XML 必须区分

[README](https://github.com/jannisborn/paperscraper/blob/730efe915b73967f16738bd7d799082b842bb16b/README.md)说明其多数据库题录与 DOI 全文入口。[`save_pdf` 源码](https://github.com/jannisborn/paperscraper/blob/730efe915b73967f16738bd7d799082b842bb16b/paperscraper/pdf/pdf.py#L118)先解析 DOI 重定向，再走预印本或出版商页面；通用页面读取明确的 PDF 元标签，并尝试附带落地页响应 Cookie 与 Referer 请求 PDF。[回退源码](https://github.com/jannisborn/paperscraper/blob/730efe915b73967f16738bd7d799082b842bb16b/paperscraper/pdf/fallbacks.py)包含 Wiley TDM PDF、BioC-PMC XML、Elsevier TDM XML、eLife XML 和 bioRxiv S3。出版商 API 需要对应凭据/权限，S3 使用 requester-pays。

[项目自己的全文示例](https://github.com/jannisborn/paperscraper/blob/730efe915b73967f16738bd7d799082b842bb16b/docs/examples/pdf-retrieval.md)明确 XML 回退写 `.xml`，这些机制不能越过出版商访问限制。因此 `save_pdf=True` 不能直接当成“PDF 已归档”。此外，[通用元标签分支](https://github.com/jannisborn/paperscraper/blob/730efe915b73967f16738bd7d799082b842bb16b/paperscraper/pdf/pdf.py#L333)写入有效 PDF 后没有同步把局部 `success` 设为 `True`，末尾仍返回该变量；这是静态源码观察，未运行确认。直接采用前必须做文件格式与返回状态回归。

接入成本判断：[配置](https://github.com/jannisborn/paperscraper/blob/730efe915b73967f16738bd7d799082b842bb16b/pyproject.toml)要求 Python 3.9–3.13，并依赖 arxiv、pandas、scholarly、boto3 等。给 Electron 应用整体加入 Python 进程、依赖打包、协议转换和凭据管理的成本高于将必要的解析机制接到现有 TypeScript 全文获取服务。MIT 代码复用应保留相应版权和许可声明；现阶段仅研究机制，没有复制项目代码。

### PyAlex：确有 PDF 接口，但仍依赖 OpenAlex

不能把 PyAlex 简化为“只能查题录”：[`BaseContent` / `PDF` / `Work.pdf`](https://github.com/J535D165/pyalex/blob/875c708cbb6e449feebc46d2a7a26af8ed8b2fdd/pyalex/api.py#L877)确实实现内容获取与保存，使用 `OpenAlexAuth`；[`Retry` 配置](https://github.com/J535D165/pyalex/blob/875c708cbb6e449feebc46d2a7a26af8ed8b2fdd/pyalex/api.py#L43)允许配置 429/500/503 重试，但默认重试次数为 0。`BaseContent.get()`自己拼接无扩展名 URL，而 `PDF.url` 提供 `.pdf`，采用前需核验实际响应格式；未据此认定远端不可用。

[OpenAlex 官方认证说明](https://help.openalex.org/api/authentication/)区分日预算耗尽与短时频率限制，二者都可能返回 429。[官方全文说明](https://help.openalex.org/access/fulltext/)说明缓存 PDF/TEI 需要 API Key，下载计入日用量。Python 包不会改变这些规则。其 [Python 依赖](https://github.com/J535D165/pyalex/blob/875c708cbb6e449feebc46d2a7a26af8ed8b2fdd/pyproject.toml)虽少，但 EconoMind 已直接调用相同 API，引入额外运行时不增加来源覆盖。

### Paperfetcher：适合扩展检索，不是 PDF 获取器

[`handsearch.py`](https://github.com/paperfetcher/paperfetcher/blob/850bcd6a16e28ef2b926566fcca4e8839696ab3d/paperfetcher/handsearch.py)使用 Crossref 获取指定 ISSN 的文章，按关键词和日期过滤，转换 DOI/RIS；[`snowballsearch.py`](https://github.com/paperfetcher/paperfetcher/blob/850bcd6a16e28ef2b926566fcca4e8839696ab3d/paperfetcher/snowballsearch.py)使用 Crossref 和 OpenCitations COCI 获取参考文献与被引记录。[API 客户端](https://github.com/paperfetcher/paperfetcher/blob/850bcd6a16e28ef2b926566fcca4e8839696ab3d/paperfetcher/apiclients.py)指向这些题录/引文服务。这能增加检索途径，不能保证所得 DOI 有开放 PDF。整体接入还需其 [Python/pandas/RIS 等依赖](https://github.com/paperfetcher/paperfetcher/blob/850bcd6a16e28ef2b926566fcca4e8839696ab3d/setup.py)，不推荐为本次下载问题引入。

## Zotero 与知网

### 值得参考的项目与版本

| 项目                                                                      | 核查版本                                                                                                                                          | 用途与接入判断                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [Zotero translators](https://github.com/zotero/translators)               | [3d1c785，2026-10-01](https://github.com/zotero/translators/commit/3d1c78530f42892328e08741b7cac8474ff687b8)；其中 CNKI 文件标注更新于 2023-11-27 | 官方站点适配框架与旧知网实现；适合研究识别、题录、附件三个阶段，不能只根据仓库活跃度判断知网适配的新旧      |
| [translators_CN](https://github.com/l0o0/translators_CN)                  | [f2806e7，2026-09-29](https://github.com/l0o0/translators_CN/commit/f2806e71bac13fc5ed08b6196f74f81da820f665)；CNKI 文件标注同日更新              | 较新的中文网站适配；优先参考当前知网详情页与批量处理机制，运行依赖 Zotero 的 `Z`/`ZU` 翻译环境              |
| [Zotero Connector](https://github.com/zotero/zotero-connectors)           | [876e41a，2026-09-17](https://github.com/zotero/zotero-connectors/commit/876e41ad15139077f2e07b2f71a0fa94742e0b4a)                                | 在用户实际浏览的页面执行识别与保存，附件通过浏览器扩展获取后交给桌面端；不能当作普通 Node 模块嵌入 Electron |
| [Zotero translation-server](https://github.com/zotero/translation-server) | [3a9d176，2026-07-31](https://github.com/zotero/translation-server/commit/3a9d17614896fc1fea73d7b880ea79273b605275)                               | 可独立提供 URL/DOI 题录解析；不是现成的 PDF 下载与归档服务，也不会自动获得用户 Edge 的知网会话              |

Zotero 主程序、Connector、translation-server 和上述 CNKI translator 的源码声明均采用 AGPLv3 或 AGPLv3-or-later，见 [主程序 COPYING](https://github.com/zotero/zotero/blob/9071805bdc35b3944aa23c0125d685306e9c54bd/COPYING)、[Connector COPYING](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/COPYING)、[server COPYING](https://github.com/zotero/translation-server/blob/3a9d17614896fc1fea73d7b880ea79273b605275/COPYING) 和 [中文 CNKI 文件头](https://github.com/l0o0/translators_CN/blob/f2806e71bac13fc5ed08b6196f74f81da820f665/CNKI.js#L15-L31)。EconoMind 的 [package.json](../package.json) 声明 Apache-2.0；直接纳入上游代码需保留并评估其许可要求，不能给复制的代码重新标为 Apache。此次只根据网页入口独立补充兼容，没有纳入上游代码。

### Zotero 实际如何获取文献

1. **识别站点与文献。** Translator 根据网址与 DOM 判断单篇/多篇，提取题录和附件候选。用户在文章主页保存时，Zotero 可同时保存可访问的 PDF 或找到开放版本，见 [官方使用说明](https://www.zotero.org/support/adding_items_to_zotero)。
2. **知网题录与附件分开。** 官方旧版从 `dbname`/`filename`、隐藏字段或检索行属性识别文章，通过 `ShowExport` 请求 RefWorks 题录；它明确在多结果页不添加 PDF/CAJ，详情页还检查旧的 `loginuserid` 字段，见 [官方 CNKI.js](https://github.com/zotero/translators/blob/3d1c78530f42892328e08741b7cac8474ff687b8/CNKI.js#L72-L134)、[导出与附件处理](https://github.com/zotero/translators/blob/3d1c78530f42892328e08741b7cac8474ff687b8/CNKI.js#L235-L357)。因此不能直接拿旧版替换我们的“选择检索条目后下载 PDF”。
3. **新版中文适配逐篇解析。** 社区版多条目保存依次请求文章详情；详情可从 DOM 或页面声明的导出接口读取题录。附件默认优先 `.btn-dlpdf > a`，缺失 PDF 时可返回 CAJ，见 [批量详情请求](https://github.com/l0o0/translators_CN/blob/f2806e71bac13fc5ed08b6196f74f81da820f665/CNKI.js#L115-L142)、[题录 API](https://github.com/l0o0/translators_CN/blob/f2806e71bac13fc5ed08b6196f74f81da820f665/CNKI.js#L527-L572)、[附件逻辑](https://github.com/l0o0/translators_CN/blob/f2806e71bac13fc5ed08b6196f74f81da820f665/CNKI.js#L761-L800)。我们只接收经校验的 PDF，不把 CAJ 当成 PDF 成功。
4. **实际文件由附件层处理。** 当前 Connector 在浏览器扩展侧保存 PDF/EPUB，交给本地 Zotero，而不是由 Translator 自己将 URL 写成文件，见 [itemSaver.js](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/itemSaver.js#L173-L209)。桌面端另有 DOI、页面 URL、开放版本与自定义 resolver 回退，见 [attachments.js](https://github.com/zotero/zotero/blob/9071805bdc35b3944aa23c0125d685306e9c54bd/chrome/content/zotero/xpcom/attachments.js#L1268-L1340)。

Zotero 的桌面下载器会校验文件，部分受支持站点遇到 HTML/403 时转浏览器请求，必要时显示验证码；其回退按站点注册，当前列表未包含知网。因此“Zotero 有浏览器回退”不等于“任何知网页面都可自动下载”。来源：[下载与文件校验](https://github.com/zotero/zotero/blob/9071805bdc35b3944aa23c0125d685306e9c54bd/chrome/content/zotero/xpcom/attachments.js#L1166-L1239)、[BrowserRequest 注册与实现](https://github.com/zotero/zotero/blob/9071805bdc35b3944aa23c0125d685306e9c54bd/chrome/content/zotero/xpcom/browserRequest.js#L28-L100)。机构 IP 授权仍取决于实际网络与订阅；下载链中的跳转和 Cookie 也可能参与 IP 认证，见 [核心下载器相关处理](https://github.com/zotero/zotero/blob/9071805bdc35b3944aa23c0125d685306e9c54bd/chrome/content/zotero/xpcom/attachments.js#L2236-L2246)。

### 为什么不直接接 translation-server

其 [README](https://github.com/zotero/translation-server/blob/3a9d17614896fc1fea73d7b880ea79273b605275/README.md) 将 `/web` 和 `/search` 定义为题录转换；[ItemSaver 实现](https://github.com/zotero/translation-server/blob/3a9d17614896fc1fea73d7b880ea79273b605275/src/translation/translate_item.js#L26-L34) 明确仅运行在 object-only 模式，没有真实的文件保存器。`attachments[].url` 仍只是候选地址。

服务会建立自己的 Cookie jar，仅转发 `Accept-Language` 请求头，见 [webSession.js](https://github.com/zotero/translation-server/blob/3a9d17614896fc1fea73d7b880ea79273b605275/src/webSession.js#L35-L63) 和 [会话初始化](https://github.com/zotero/translation-server/blob/3a9d17614896fc1fea73d7b880ea79273b605275/src/webSession.js#L114-L176)。如果把它放在外部服务器，出口 IP 与用户校园网还可能不同。它适合未来统一题录解析，不是本次机构登录/PDF 问题的直接替代。

### 本次实际采用的最小改动

在 [`cnki-pdf-download.ts`](../src/main/literature/discovery/cnki-pdf-download.ts) 中增加新版 `.btn-dlpdf > a`、旧版 `a[name="pdfDown"]`、学位论文 `#DownLoadParts` 中标识 PDF 的下载入口，继续复用现有浏览器会话与文件验证。没有加入 CAJ 回退、安装 Zotero 或整体导入 translator。题录导出 API 与通用 DOI resolver 是后续可选改进，尚未实现。

验证范围：22 项现有下载、浏览器、Provider 与 PDF 链接回归测试通过；隔离 Edge 的 6 种页面入口均下载到原始的两页 PDF，保留模拟机构 Cookie，CAJ 下载次数为 0。其中新增的 3 类入口均证明旧选择器匹配数为 0。Node TypeScript 检查、ESLint、Prettier 和 diff 空白检查通过。这里验证的是页面识别与真实浏览器下载，不是知网授权服务的可用性；真实知网 PDF 成功仍需有效机构 IP/订阅会话。

## 对当前实现的建议

当前 EconoMind 已有 PMC、Europe PMC、Unpaywall、OpenAlex、arXiv 多源全文查找，明确 PDF 链接提取，以及下载格式/大小/页数/校验值验证，见 [`full-text-finder.ts`](../src/main/literature/full-text-finder.ts)、[`full-text-links.ts`](../src/main/literature/full-text-links.ts) 和 [现有功能说明](literature-discovery.md)。因此“加入一个现成多源下载库”不是从零获得这些能力。

建议保持题录检索与全文获取分离，采用最小必要的来源适配：OpenAlex 保留正确的 Key、额度和冷却处理；可借鉴 Paperscraper 的 DOI→出版商落地页→明确 PDF 链接链路和按出版商回退，复用现有安全下载与归档验证。此为基于源码和当前架构的工程判断，尚未测量替代方案的下载成功率。知网保留文章详情→官方 PDF 按钮→本地持久会话这一流程，本次已补充有源码证据的入口兼容；更完整的题录适配仍应以实际页面和授权会话验证为依据。

不推荐整体替换为 PyAlex（同源配额、无新增覆盖），也不推荐将 Paperfetcher 当成 PDF 下载器；Paperscraper 的部分策略值得采用，整体依赖和 PDF/XML 状态语义仍需控制。
