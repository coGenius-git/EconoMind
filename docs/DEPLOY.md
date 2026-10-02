# EconoMind 部署指南（Web 模式）

EconoMind（经管智研工作台，AI-powered Economics & Management Research Assistant）
是面向经济学、管理学、金融学、会计学与公共政策研究者的 AI 辅助研究工作台，
在保留原项目（Open Science）核心架构（Agent 工作流、项目管理、文件系统、模型调用）的基础上
完成领域迁移与功能裁剪。本文档说明 Web 模式的构建、运行与部署。

## 1. 产品形态

- 桌面应用（Electron）：`npm run dev` / `npm run build:unpack` / `npm run build:win`
- Web 模式（浏览器访问）：`npm run dev:web`（开发）/ `npm run build:web`（产物构建）

两种形态共享同一套 renderer 与主进程能力；Web 模式用于快速体验与轻量部署。

## 2. Web 模式开发运行

```bash
npm install
npm run dev:web
```

- `dev:web` 会先执行 `dev-app-branding.cjs` 注入开发品牌，再启动本地 Web 服务。
- 默认绑定本地端口（由 `scripts/dev-web.cjs` 输出）；浏览器打开输出地址即可。
- 无头模式：`npm run dev:headless`（适用于 CI / 容器）。

## 3. Web 产物构建

```bash
npm run build:web
```

- 先运行 `gen:web-api-map` 生成 Web 可用的 API 清单，再由 Vite 构建静态产物。
- 产物输出目录以 Vite 配置（`vite.web.config.ts`）为准，通常为 `dist/` 或 `out/`。

## 4. 部署到 Web 服务器

1. 构建：`npm run build:web`。
2. 将产物目录作为静态站点发布到任意 Web 服务器 / CDN（Nginx、Caddy、对象存储等）。
3. 代理规则：Web 模式通过预生成 API 映射与本地或远端模型端点通信；请确保
   `/api` 前缀（或配置中声明的端点路径）被反向代理到模型服务，未代理时模型调用会降级。
4. 环境变量：沿用 `OPEN_SCIENCE_*` 前缀的配置项（兼容既有部署脚本），
   具体变量清单见 `src/shared/app-config.ts` 与启动日志。

## 5. 默认启用的 Skills / Connectors

### Bundled Skills（`resources/skills/manifest.json`，14 项，均可在设置中关闭）

| Skill | 用途 |
| --- | --- |
| Literature Review | 文献检索与综述（OpenAlex / arXiv） |
| Literature Screening | 文献综述筛选工作流（关键词扩展 → 来源配置 → 导入 → 结构化分析 → 五维评分筛选表） |
| Bibliometrics | 文献计量分析（共词分析、关键词聚类、研究热点、时间演化） |
| Research Design | 研究设计助手（研究框架、理论基础、变量设计、假设、模型） |
| Econometrics Assistant | 计量分析助手（描述统计、相关分析、回归模型建议、Python/R 代码模板） |

其余 bundled skills 为平台基础能力（文档、代码、网页、图片等），可按需关闭。

### Connectors

- **literature（Literature Graph）**：文献连接器，数据源 OpenAlex 与 arXiv。
  文献检索使用 OpenAlex 时需配置 API Key（设置 → 连接器 → Literature Graph）。

### 内置 Specialists（`resources/specialists/manifest.json`，4 项）

| Specialist | 职责 |
| --- | --- |
| Literature Agent | 文献检索 / 阅读 / 分类 / 筛选 / 摘要提取 |
| Methodology Agent | 研究方法识别 / 模型分析 / 变量设计 / 计量方法建议 |
| Data Agent | 数据集整理 / 数据清洗 / 描述统计 / 可视化 |
| Review Agent | 研究逻辑检查 / 引用核验 / 方法合理性评估 |

Specialist 为研究辅助角色，不自动生成论文正文；研究者拥有最终判断权。

## 6. 验证命令

```bash
npm run lint          # ESLint 全仓检查
npm test              # 单元测试（vitest；并发多文件时建议 --maxWorkers=1）
npm run typecheck     # node + web 双重类型检查
npm run build         # typecheck + electron-vite build + build:web
npm run test:e2e      # Playwright 端到端（需 Electron 环境）
```

## 7. 安全提示

- 部署到公网前配置认证（登录 / 反向代理鉴权）；Web 模式默认面向受信网络。
- 模型 API Key 通过设置页凭据存储，不写入前端产物；请勿将 `.env` / 密钥提交到仓库。
- 用户数据（项目、文献库、会话）默认落在本地用户目录；备份策略与桌面版一致。
