# EconoMind · 经管智研工作台

面向经济学、管理学、金融学、会计学与公共政策研究的 AI 辅助研究软件。EconoMind 将文献工作区、研究设计、智能体会话和代码执行组织在同一个本地工作台中。

本仓库由 [coGenius-git/EconoMind](https://github.com/coGenius-git/EconoMind) 维护，基于 AIPOCH 的 Open Science 项目进行经管领域定制。源码来源、继承能力和兼容标识见 [上游来源说明](UPSTREAM.md)，许可证见 [LICENSE](LICENSE)。

## 项目状态

- 产品形态：Electron 桌面软件，也提供依赖应用后端的本地 Web 模式。
- 当前源码版本：`0.27.2`，以 [package.json](package.json) 为准。
- 已有定制安装包使用 `3.0.0` 标签；源码版本与安装包标签属于不同的版本记录。
- 本仓库目前主要存放源码，GitHub Actions 已关闭；上游的下载、DOI、签名和跨平台发布记录不代表本仓库的发布成果。
- 已在 Windows 上验证依赖安装、源码开发启动、页面加载和数据库就绪。这不等于所有功能、外部模型和其他平台均通过验收。

## 主要工作区

| 工作区       | 源码中的功能                                    |
| ------------ | ----------------------------------------------- |
| 文献筛选     | 文献导入、筛选条件、结构化评分和结果导出        |
| 文献计量     | 关键词、研究热点与文献关系分析辅助              |
| 研究设计     | 研究问题、理论框架、变量、假设和方法建议        |
| 计量分析     | 数据分析、模型建议、Python/R 代码与结果解释辅助 |
| 项目与智能体 | 按项目组织会话、文件、专家角色与研究输出        |

上述功能仍需结合具体数据、模型配置和测试结果判断是否适合某项研究。模型输出、引用和统计结论需要研究者核验。

## 从源码启动

准备 Git、Node.js 和 npm。`.nvmrc` 建议 Node.js 22；Windows 本机模块编译还需要 Python 和 Visual Studio C++ Build Tools。依赖安装会执行仓库的 `postinstall`，生成 Prisma Client 并准备 Electron 模块。

```bash
git clone https://github.com/coGenius-git/EconoMind.git
cd EconoMind
npm ci
npm run dev
```

仓库为私有时，克隆需要具有访问权限的 GitHub 账号。首次启动按向导选择数据位置和模型；模型凭据在软件中配置，不写入源码。

### 独立开发配置（PowerShell）

下列方式将开发配置、数据库、会话与 Electron 用户配置保存到仓库内已忽略的 `.dev-isolate/` 目录，适合与安装版并行使用：

```powershell
$sourceProfile = Join-Path (Get-Location) '.dev-isolate'
$env:OPEN_SCIENCE_STORAGE_ROOT = Join-Path $sourceProfile 'storage'
$env:OPEN_SCIENCE_E2E_STORAGE_ROOT = $env:OPEN_SCIENCE_STORAGE_ROOT
$env:OPEN_SCIENCE_USER_DATA = Join-Path $sourceProfile 'electron-user-data'
$env:OPEN_SCIENCE_ALLOW_MULTI_INSTANCE = '1'
New-Item -ItemType Directory -Force -Path $env:OPEN_SCIENCE_STORAGE_ROOT, $env:OPEN_SCIENCE_USER_DATA | Out-Null
npm run dev
```

这些环境变量仅影响当前 PowerShell 会话。名称保留 `OPEN_SCIENCE_*` 是源码兼容约定，含义见 [上游来源说明](UPSTREAM.md)。

### 本地 Web 模式

```bash
npm run dev:web
```

打开启动日志输出的带认证信息的本机地址。Web 模式仍需 Electron 主进程提供项目、文件与模型等后端能力；仅上传前端静态文件不能运行完整软件。详细说明见 [运行指南](docs/DEPLOY.md)。

## 构建与验证

```bash
npm run typecheck
npm run lint
npm test -- <相关测试文件>
npm run build
```

打包定制 Windows 版本时使用 `electron-builder.share.yml`；该配置关闭上游更新发布。先准备构建要求的运行时资源，再按 [运行指南](docs/DEPLOY.md) 打包。构建、安装包启动、模型请求和功能验收是分别需要执行的验证步骤。

## 目录与文档

| 路径                                          | 内容                                  |
| --------------------------------------------- | ------------------------------------- |
| `src/main/`                                   | Electron 主进程、存储、模型与研究流程 |
| `src/renderer/`                               | 桌面及 Web 界面                       |
| `src/preload/`、`src/shared/`                 | 界面桥接、协议与共享类型              |
| `resources/skills/`、`resources/specialists/` | 技能及专家角色                        |
| `packages/`                                   | CLI/SDK、网络沙箱与本机模块           |
| `prisma/`、`build/`、`scripts/`               | 数据模型、打包资源和开发脚本          |

- [文档索引](docs/README.md)
- [开发与贡献](CONTRIBUTING.md)
- [路线图](ROADMAP.md)
- [安全与问题反馈](SECURITY.md)
- [本地 Web 与远程访问边界](REMOTE_CONTROL.md)
- [上游来源与兼容说明](UPSTREAM.md)

## 数据与 GitHub

软件记录存放在你选择的本地数据目录。GitHub 保存已提交并推送的源码，不会自动同步软件里的聊天、文献或模型配置。

[.gitignore](.gitignore) 已排除依赖、编译输出、`.dev-isolate/`、运行目录、数据库、真实环境配置和凭据。新增数据存储位置时先检查忽略规则；已经被 Git 跟踪的文件不会因新增忽略规则自动退出跟踪。

模型调用和外部连接器会向你配置的服务发送任务所需内容，这与 GitHub 源码同步是两个独立过程。

## 反馈与许可

本项目的问题和建议提交到 [EconoMind Issues](https://github.com/coGenius-git/EconoMind/issues)。提供日志或截图前移除密钥、账号、私人路径和研究数据。

本项目沿用 Apache-2.0 许可。保留 AIPOCH / Open Science 及依赖代码的原有署名、许可和版权声明；详细来源见 [UPSTREAM.md](UPSTREAM.md)。
