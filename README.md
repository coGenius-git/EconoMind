# EconoMind · 经管智研工作台

面向经济学、管理学、金融学与会计学研究的 AI 桌面工作台，把文献、研究会话、数据分析和成果文件组织在同一项目中。

EconoMind 是华北五省智能体大赛团队基于 [AIPOCH Open Science](https://github.com/aipoch/open-science) 定制的项目。基础运行框架继承上游，经管领域的界面、技能与专家适配见 [来源与修改说明](UPSTREAM.md)。

[快速开始](#快速开始) · [源码导航](docs/CODEBASE.md) · [开发贡献](CONTRIBUTING.md) · [团队协作](docs/TEAM_GUIDE.md) · [文档索引](docs/README.md)

## 主要功能

| 模块                | 用途                                             | 说明                                                                                                            |
| ------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 项目工作区          | 按项目组织研究会话、输入材料与输出文件           | 通过工作区开展任务并查看文件                                                                                    |
| 文献库              | 检索、导入、去重、筛选与引用导出                 | 全文获取取决于来源、登录状态及访问权限，见 [文献检索与初筛](docs/literature-discovery.md)                       |
| 文献计量            | 辅助整理和分析文献集合                           | 入口位于研究工具页面，源码见 [BibliometricsPanel](src/renderer/src/pages/research-tools/BibliometricsPanel.tsx) |
| 经管专家            | 文献查找、文献综述、研究设计、数据审计、研究评审 | 五类角色及任务示例见 [经管研究专家](docs/econ-research-experts.md)                                              |
| Notebook 与文件预览 | 执行研究代码，查看文档、数据和结果               | 执行需要可用的计算环境；Windows 还需要构建沙箱宿主                                                              |
| 模型与工具配置      | 配置模型提供方、技能与连接器                     | 在软件设置中完成，实际任务需要有效的模型配置                                                                    |

这些是当前源码提供的模块和使用方向。模型生成的引用、方法与结论仍需结合原始材料核验；计划与验收要求见 [产品需求](docs/PRD.md)。

## 快速开始

### 直接使用安装版

已有安装包可直接安装并按首次设置向导配置数据目录、运行环境和模型。需要获取项目版本时查看 [EconoMind Releases](https://github.com/coGenius-git/EconoMind/releases)，源码与安装包版本应分别核对。

本仓库目前为私有仓库，访问源码和发布页需要相应 GitHub 权限。

### 从源码启动（Windows PowerShell）

| 工具                           | 要求                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| Git                            | 能使用自己的 GitHub 账号访问此仓库                                |
| Node.js / npm                  | Node.js **24.x**，以 [.nvmrc](.nvmrc) 为准；使用 npm 和仓库锁文件 |
| Python                         | Python 3，供本机模块编译使用；既有指南建议 3.12                   |
| Visual Studio Build Tools 2022 | C++ 桌面开发、MSVC v143 与 Windows SDK                            |
| Rust                           | Windows MSVC 工具链，用于 Notebook 沙箱宿主                       |

```powershell
git clone https://github.com/coGenius-git/EconoMind.git
cd EconoMind
npm ci
npm run build:notebook-host
npm run dev:isolated
```

`npm ci` 会下载依赖、应用补丁、生成 Prisma Client 并准备 Electron 本机模块，需要可用的网络和编译工具。不要使用 `--ignore-scripts` 跳过这些步骤。

打开开发窗口后按向导完成设置。浏览界面不要求把 API Key 写入源码；实际模型请求需在应用设置中配置凭据。Windows 缺少沙箱宿主时，Notebook 和命令行执行不可用，详见 [Windows Notebook 开发准备](docs/DEPLOY.md#windows-notebook-开发准备)。

### 独立开发配置（PowerShell）

日常开发使用 `npm run dev:isolated`。它将开发配置、数据库和研究文件保存到已被 Git 忽略的 `.dev-isolate/`，允许与安装版并行运行。下次启动会继续使用这些数据，更新源码时保留该目录。

关闭开发窗口后，用 `Ctrl+C` 结束终端进程，再运行构建或其他检查。安装失败、PowerShell 执行策略和浏览器准备等问题见 [团队指南的常见问题](docs/TEAM_GUIDE.md#常见问题)。

macOS / Linux 的编译工具与平台资源需另行准备；此处 Windows 命令不表示跨平台均已验证。

## 常用命令

在仓库根目录执行，完整定义见 [package.json](package.json)。

| 命令                                                        | 用途                                              |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `npm run dev:isolated`                                      | 启动独立数据目录的桌面开发环境                    |
| `npm run build:notebook-host`                               | 构建 Windows Notebook 沙箱宿主                    |
| `npm run typecheck`                                         | 检查主进程、沙箱与界面类型                        |
| `npm run lint`                                              | ESLint 检查                                       |
| `npm test -- src/main/research-tools/bibliometrics.test.ts` | 运行指定模块测试；按修改内容替换路径              |
| `npm run build`                                             | 类型检查并构建 Electron 与 Web 资源，不生成安装包 |
| `npm run build:web`                                         | 构建本地 Web 界面                                 |
| `npm run dev:web`                                           | 启动 Electron 后端与本地 Web 服务                 |

Web 界面依赖运行中的 Electron 后端，不能仅上传静态文件运行完整软件。Windows 分享包的资源准备与打包命令见 [运行与打包指南](docs/DEPLOY.md)。

## 代码结构

技术栈：Electron、React、TypeScript、Vite、Tailwind CSS、Prisma / SQLite；测试使用 Vitest 和 Playwright。

```text
EconoMind/
├── src/
│   ├── main/          # Electron 主进程、存储、模型与研究能力
│   ├── preload/       # 主进程与界面之间的桥接
│   ├── renderer/      # React 页面、组件、状态和 Web 适配
│   └── shared/        # 共享类型、协议与翻译
├── resources/         # 专家、技能、Notebook 与预览运行资源
├── packages/          # CLI/SDK、网络沙箱和本机模块
├── prisma/            # 数据模型与迁移
├── scripts/           # 开发、验证与打包脚本
├── e2e/               # Playwright 端到端测试
├── test/              # 测试辅助资源
├── build/             # 打包所需源资源
├── patches/           # 安装时应用的依赖补丁
└── docs/              # 使用、开发、设计与历史验证文档
```

按功能定位入口和相关测试，请看 [源码导航](docs/CODEBASE.md)。`build/` 包含打包源资源；生成目录主要是 `out/`、`dist/`，不要混淆。

## 项目状态

- 当前源码版本为 **0.34.1**，以 [package.json](package.json) 为准；另有配置使用 `3.0.0` 安装包标签，见 [上游与版本说明](UPSTREAM.md)。
- [协作准备检查记录](docs/COLLABORATION_CHECK.md) 保存既有安装、启动、构建结果及全量测试失败情况。这是历史证据，不代表当前提交或所有平台均已通过。
- `.github/workflows/` 含继承的上游流程；工作流文件存在不代表检查或发布服务已经启用。合并与发布前核对仓库设置及对应提交的实际检查结果。

## 参与开发

从一个明确任务开始，在任务分支修改并做相应验证。环境准备和开发约定见 [CONTRIBUTING.md](CONTRIBUTING.md)，团队分工及 Git / PR 步骤见 [团队协作指南](docs/TEAM_GUIDE.md)。

GitHub 保存源码，不会自动同步应用里的聊天、文献、数据库或模型配置。提交前检查暂存区，保留研究数据在本地；详见 [.gitignore](.gitignore) 和 [安全反馈](SECURITY.md)。

## 开源来源与许可

采用 [Apache-2.0](LICENSE)。上游代码版权归 AIPOCH 及其贡献者，EconoMind 修改部分版权归相应贡献者。保留 [NOTICE](NOTICE)、[上游来源](UPSTREAM.md) 以及 [第三方说明](docs/OPEN_SOURCE.md) 中的署名与许可。

`open-science` CLI、`@aipoch/*` 包名与 `OPEN_SCIENCE_*` 环境变量仍用于兼容，不因项目更名而批量替换。
