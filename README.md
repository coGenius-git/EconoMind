# EconoMind · 团队协作指南

这是华北五省智能体大赛团队的源码仓库。EconoMind 是面向经济学、管理学、金融学与会计学研究的 Electron 桌面软件，基于 [AIPOCH Open Science](https://github.com/aipoch/open-science) 修改和扩展，并沿用 Apache-2.0 许可证。

上游代码版权归 AIPOCH 及其贡献者；EconoMind 修改部分版权归相应贡献者。完整许可见 [LICENSE](LICENSE)，二次开发署名见 [NOTICE](NOTICE)，来源与修改范围见 [UPSTREAM.md](UPSTREAM.md) 和 [开源与第三方说明](docs/OPEN_SOURCE.md)。

**参与流程：获得仓库权限 → 克隆 → 安装依赖 → 启动独立开发环境 → 从最新 `main` 建任务分支 → 修改、验证 → 推送分支并提交 PR → 审查合并。**

## 1. 首次安装与启动

本指南以 Windows PowerShell 为例。仓库为私有仓库：维护者邀请队友后，队友需接受邀请，并使用自己的 GitHub 账号登录才能克隆。不要共享维护者的密码或令牌。

| 工具                           | 要求                                                       | 检查                              |
| ------------------------------ | ---------------------------------------------------------- | --------------------------------- |
| Git                            | Git for Windows，可通过 Git Credential Manager 登录 GitHub | `git --version`                   |
| Node.js                        | **24.x**，与 `.nvmrc` 一致；本次验证使用 npm **11.x**      | `node --version`、`npm --version` |
| Python                         | 本机模块编译需要 Python 3，建议 3.12                       | `py -3 --version`                 |
| Visual Studio Build Tools 2022 | 勾选“使用 C++ 的桌面开发”，包括 MSVC v143 与 Windows SDK   | 安装后重新打开终端                |

依赖安装会下载 Electron、生成 Prisma Client、应用仓库补丁并编译本机模块。需要能访问 npm、GitHub 和相关依赖下载服务，首次安装可能需要几分钟。

先检查两个版本。如果曾安装全局 npm，切换 Node 后 npm 仍可能从用户目录加载另一版本；用 `Get-Command npm -All` 检查入口。完整验证环境为 Node 24.15.0 / npm 11.12.1，其他组合需另行验证。

在打算保存源码的目录打开 PowerShell：

```powershell
git clone https://github.com/coGenius-git/EconoMind.git
cd EconoMind
npm ci
npm run dev:isolated
```

`npm ci` 使用锁文件中的依赖版本，不要用 `--ignore-scripts` 跳过安装步骤。出现 **EconoMind (DEV)** 开发窗口后，按向导设置模型。打开界面无需先把 API Key 写入代码；实际模型任务需要在软件设置中配置有效凭据。

`dev:isolated` 自动把开发配置、数据库、文献与会话保存到已忽略的 `.dev-isolate/`，并允许与安装版并行运行。关闭窗口后用 `Ctrl+C` 结束开发进程。下次启动继续使用相同数据；**不要删除 `.dev-isolate/` 来更新源码**。

普通 `npm run dev` 使用应用默认数据位置；团队日常开发建议使用 `dev:isolated`，避免混用正式研究数据。

### 常见问题

| 现象                                     | 处理                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Repository not found` / 无法克隆        | 确认已接受邀请，Git 登录的账号具有权限                                                                                                                                         |
| PowerShell 阻止 `npm.ps1`                | 使用 `npm.cmd ci`、`npm.cmd run dev:isolated`，不必关闭系统执行策略                                                                                                            |
| `node-gyp` 找不到 Python / Visual Studio | 安装上表工具与 C++ 工作负载，重开终端后重新 `npm ci`；多版本 Python 可在当前终端设置 `$env:PYTHON = '你的 python.exe 完整路径'`                                                |
| 下载超时 / `ECONNRESET`                  | 检查自己的网络或代理，再重试 `npm ci`；不要提交个人代理、`.npmrc` 或镜像凭据                                                                                                   |
| `EALLOWREMOTE` 拒绝下载 `echarts`        | 更新任务分支的锁文件；已将同版本包地址统一到官方 npm 仓库，完整性校验不变，再执行 `npm ci`                                                                                     |
| Prisma Client 缺失或与 schema 不一致     | 先确保 `npm ci` 完整成功再启动；安装失败需先修复安装错误。切分支只改变 schema 时可执行 `npx prisma generate`                                                                   |
| Electron 按 Node 启动                    | `dev:isolated` 会移除继承的 `ELECTRON_RUN_AS_NODE` 环境变量                                                                                                                    |
| peer / deprecated 警告                   | 警告与失败不同，查看退出码和最终错误；不要为消除警告自行升级整套依赖                                                                                                           |
| 文献检索提示找不到可用浏览器             | 本功能使用系统自带的 Edge 或 Chrome，通常无需处理；两者都没有时执行 `node node_modules/playwright/cli.js install chromium`，详见[文献检索与初筛](docs/literature-discovery.md) |
| 知网检索提示需要安全验证                 | 点击「登录知网」，在弹出的窗口内完成滑块验证，然后关闭该标签页                                                                                                                 |

本次检查范围为 Windows x64。macOS/Linux 的编译工具不同，先参考 [运行指南](docs/DEPLOY.md)，验证后再补充对应步骤。

## 2. 团队分工

以下按分工图整理，属于待推进任务，不表示相关新功能已经完成。每项任务先建 Issue，说明范围、预期效果与验收方法。

| 任务                       | 负责人 | 建议查看的源码                                                                                         | 交付与验收                                                                                                |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 新版 EconoMind 新功能增加  | 陈     | `UPSTREAM.md`、`src/main/`、`src/renderer/`                                                            | 先列出具体功能与上游版本；逐项适配并提供操作示例和测试结果，避免整仓覆盖                                  |
| AI 生图、UI 设计方案选择   | 林     | `docs/design.md`、`src/renderer/src/pages/`                                                            | 选定方案、页面效果与交互说明，交接给 UI 实现                                                              |
| UI 修改与实现              | 王     | `src/renderer/src/pages/`、`src/renderer/src/components/`                                              | 实现方案；附截图，检查缩放、中文显示与主要交互                                                            |
| 专家完善                   | 许     | `resources/specialists/`、`resources/skills/`、`src/main/specialist/`                                  | 完善专家角色与能力，给出可运行示例及输出核验说明                                                          |
| 专家引导式介绍             | 王     | `src/renderer/src/pages/onboarding/`、`src/renderer/src/pages/settings/`                               | 用户理解专家用途并能进入示例；引导与实际能力一致                                                          |
| 文献库、工作流板块放置区域 | 陈     | `src/renderer/src/pages/literature/`、`src/renderer/src/pages/research-tools/`、`src/main/literature/` | 明确入口、位置与跳转关系；已有文献与工作流仍可正常使用                                                    |
| 链接知网、一键下载         | 李     | `src/main/literature/`、`resources/skills/`                                                            | 先确认登录与可用入口；验证有权限时下载、无权限/失败时的反馈，保留来源                                     |
| 模型/API 方案测试          | 许、陈 | 软件“设置 → 模型”、`src/shared/provider-registry.ts`                                                   | 测试图中“step plan”或其他免费 API 方案，平台名称待确认；记录模型、配置、限额和成功/失败案例，凭据仅存本地 |

目录是定位入口，不是各人独占区域。多人修改同一文件时先协调，尤其 UI、专家引导与工作流入口可能同时修改导航。**一个分支处理一个任务。**

## 3. 每次修改的 Git 流程

### 从最新主分支开始

先确认 `git status` 没有未提交修改。有修改时先在所属任务分支提交，或用自己清楚用途的 `git stash` 保存，不要覆盖文件。

```powershell
git status
git switch main
git pull --ff-only origin main
git switch -c feat/wang-ui
```

`feat/wang-ui` 是示例，请替换成自己的任务名，例如 `feat/chen-workflow`、`feat/xu-specialists`、`feat/li-cnki`、`docs/lin-ui-design` 或 `test/xu-models`。更新涉及 `package.json` / `package-lock.json` 时重新 `npm ci`。

继续已有任务时使用原分支，并合入最新主分支：

```powershell
git switch feat/wang-ui
git fetch origin
git merge origin/main
```

冲突需确认双方意图、编辑冲突文件并验证，再 `git add` 对应文件、`git commit`。不要只保留自己的一侧，不要强制推送覆盖队友提交。

### 修改与检查

```powershell
npm run dev:isolated
npm run typecheck
npm run lint
npm test -- 相关测试文件路径
npm run build
```

完成启动检查后，先关闭开发窗口并用 `Ctrl+C` 结束开发进程，再执行后续检查，避免开发服务与构建同时写入输出目录。

“相关测试文件路径”需换成实际路径，例如 `npm test -- src/renderer/src/pages/settings/SettingsPage.render.test.tsx`。新功能检查真实操作流程，界面修改附截图，模型任务检查真实请求与输出。

需要全量检查时执行 `npm test -- --maxWorkers=2`。Windows 上也可在当前终端设置 `$env:VITEST_WINDOWS_FULL_TEST = '1'` 后执行 `npm test`，使用仓库的单 worker 与超时预算。不要通过删除失败测试或跳过断言让检查通过。

新增界面文字遵循 [AGENTS.md](AGENTS.md)，八种翻译保持对应。新增依赖时同时提交 `package.json` 与 `package-lock.json`。数据库修改遵循现有迁移流程，并确认旧数据仍能打开。

### 提交与推送任务分支

```powershell
git status
git diff
git add 你实际修改的文件路径
git diff --cached
git commit -m "feat: 调整工作流入口"
git push -u origin feat/wang-ui
```

文件路径、提交说明、分支名均需替换成自己的实际内容。以后向同一分支推送只需 `git push`。不要提交安装包、数据库、日志或真实 API Key。

### 在 GitHub 提交 Pull Request

1. 打开 [仓库](https://github.com/coGenius-git/EconoMind)，进入 **Pull requests → New pull request**。
2. 选择 **base: `main`**，**compare: 自己的任务分支**。
3. 写明任务、改动、验证命令与结果、截图和已知限制。
4. 由维护者审查；反馈后的修改继续提交到原分支，PR 自动更新。
5. 审查通过后由维护者合并。其他成员切回 `main`，执行 `git pull --ff-only origin main`，再开始新任务。

GitHub Actions 当前关闭，保留的上游工作流不代表自动检查已经运行。PR 作者需如实填写本地验证结果，维护者确认后合并。通过 PR 合并是团队约定，不等于已经配置 GitHub 分支保护。

## 4. 源码地图

| 路径                                          | 用途                                  |
| --------------------------------------------- | ------------------------------------- |
| `src/renderer/src/`                           | React 页面、组件与前端状态            |
| `src/main/`                                   | Electron 主进程、模型、存储与研究流程 |
| `src/preload/`、`src/shared/`                 | 前后端桥接、协议、共享类型与翻译      |
| `resources/specialists/`、`resources/skills/` | 专家与技能资源                        |
| `prisma/`、`src/main/database/`               | 数据模型与迁移                        |
| `packages/`                                   | CLI/SDK、网络沙箱与本机模块           |
| `scripts/`、`build/`、`patches/`              | 检查、打包资源与依赖补丁              |
| `e2e/`、各目录 `*.test.*`                     | 应用、单元和组件测试                  |

`OPEN_SCIENCE_*`、部分内部路径与包名仍有兼容用途，不能因为名字旧就删除或全局替换。许可证、版权和必要补丁需保留。

本地 Web 模式可执行 `npm run dev:web`，但仍依赖 Electron 后端，不能单独上传静态页面运行整个软件。详见 [运行指南](docs/DEPLOY.md)。

## 5. 本地记录与提交边界

GitHub 只保存已提交并推送的源码，不会自动同步软件里的聊天、文献或模型配置。[.gitignore](.gitignore) 已忽略 `.dev-isolate/`、依赖、构建输出、数据库、真实环境配置与常见凭据文件。

新增数据位置时用 `git check-ignore -v 文件路径` 检查。已跟踪文件不会因新增忽略规则退出跟踪。提交前检查 `git diff --cached`；截图、日志与示例也要去除私人信息。API Key 不写入源码、README、Issue 或 PR。

## 6. 验证与其他文档

最近的实际检查见 [验证与清理记录](docs/COLLABORATION_CHECK.md)。全新安装、源码启动与构建已通过，**全量测试仍有失败**。记录区分通过项目与未验证范围，不能据此保证任何电脑或模型配置都不会报错。

- [开发约定](CONTRIBUTING.md) · [运行与打包](docs/DEPLOY.md) · [设计规范](docs/design.md)
- [文献检索与初筛](docs/literature-discovery.md) · [文档索引](docs/README.md) · [安全反馈](SECURITY.md) · [上游来源](UPSTREAM.md)

源码版本以 `package.json` 为准，目前为 `0.34.1`；既有安装包标签 `3.0.0` 属于另一份版本记录。项目沿用 [Apache-2.0](LICENSE)，保留 AIPOCH / Open Science 与依赖代码的署名和许可。
