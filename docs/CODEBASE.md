# EconoMind 源码导航

[项目首页](../README.md) · [开发约定](../CONTRIBUTING.md) · [团队协作](TEAM_GUIDE.md)

本页按当前目录和功能入口组织源码，便于接手开发。目录里的实现与测试不等于该功能已在所有环境验收；实际检查情况另见 [历史验证记录](COLLABORATION_CHECK.md)。

## 从入口理解应用

| 层次            | 入口                                                                                         | 职责                                     |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Electron 主进程 | [src/main/index.ts](../src/main/index.ts)                                                    | 启动、配置、进程生命周期及后端能力       |
| 桌面桥接        | [src/preload/](../src/preload/)                                                              | 向界面提供受控的主进程接口               |
| React 界面      | [main.tsx](../src/renderer/src/main.tsx)、[App.tsx](../src/renderer/src/App.tsx)             | 初始化界面、状态与应用呈现               |
| 共享约定        | [src/shared/](../src/shared/)                                                                | 类型、协议、能力定义与多语言资源         |
| 数据模型        | [prisma/schema.prisma](../prisma/schema.prisma)、[src/main/database/](../src/main/database/) | SQLite 元数据、数据库初始化与迁移        |
| 本地 Web        | [src/main/web-service/](../src/main/web-service/)、[src/renderer/web/](../src/renderer/web/) | Web 服务、认证及界面适配，仍依赖应用后端 |

常见桌面调用从 React 页面经 preload 桥接进入主进程；跨层改动需同时检查共享协议和调用方。会话正文与文件内容保存在磁盘，不能把 SQLite 当作全部研究数据的唯一副本。

## 按功能找代码

| 要修改的功能         | 界面入口                                                                                  | 后端或资源入口                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 项目、会话与工作区   | [pages/workspace/](../src/renderer/src/pages/workspace/)                                  | [projects/](../src/main/projects/)、[session-persistence/](../src/main/session-persistence/)                                                          |
| 文献检索、导入与筛选 | [pages/literature/](../src/renderer/src/pages/literature/)                                | [literature/](../src/main/literature/)                                                                                                                |
| 文献计量             | [BibliometricsPanel.tsx](../src/renderer/src/pages/research-tools/BibliometricsPanel.tsx) | [bibliometrics.ts](../src/main/research-tools/bibliometrics.ts)                                                                                       |
| 专家与任务示例       | [pages/specialists/](../src/renderer/src/pages/specialists/)                              | [specialist/](../src/main/specialist/)、[resources/specialists/](../resources/specialists/)                                                           |
| 研究技能             | [pages/settings/](../src/renderer/src/pages/settings/)                                    | [skills/](../src/main/skills/)、[resources/skills/](../resources/skills/)                                                                             |
| 模型、运行时与工具   | [pages/settings/](../src/renderer/src/pages/settings/)                                    | [acp/](../src/main/acp/)、[agents/](../src/main/agents/)、[provider-registry.ts](../src/shared/provider-registry.ts)                                  |
| 首次设置与引导       | [pages/onboarding/](../src/renderer/src/pages/onboarding/)                                | [settings/](../src/main/settings/)                                                                                                                    |
| Notebook 与执行环境  | [pages/workspace/](../src/renderer/src/pages/workspace/)                                  | [notebook/](../src/main/notebook/)、[resources/notebook/](../resources/notebook/)、[notebook-network-sandbox/](../packages/notebook-network-sandbox/) |
| 样式、组件与翻译     | [components/](../src/renderer/src/components/)、[assets/](../src/renderer/src/assets/)    | [i18n/locales/](../src/shared/i18n/locales/)                                                                                                          |

新增界面文案遵循 [AGENTS.md](../AGENTS.md)，设计约定见 [design.md](design.md)。经管专家的职责、示例和第三方技能来源见 [专家说明](econ-research-experts.md)。

## 测试与开发资源

单元和组件测试通常与实现相邻，例如：

- [bibliometrics.test.ts](../src/main/research-tools/bibliometrics.test.ts)：文献计量逻辑。
- [BibliometricsPanel.render.test.tsx](../src/renderer/src/pages/research-tools/BibliometricsPanel.render.test.tsx)：文献计量界面。
- [resources.test.ts](../src/renderer/src/i18n/resources.test.ts)：翻译资源与使用约定。

[e2e/](../e2e/) 保存应用操作场景，[test/](../test/) 保存测试辅助资源，[scripts/](../scripts/) 保存验证、开发和打包脚本。先运行与改动相关的检查，具体命令见 [开发速查](development-quick-reference.md)。

| 目录                                                                             | 使用边界                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [build/](../build/)、[patches/](../patches/)                                     | 打包源资源和安装依赖补丁，应保留在版本控制中                             |
| [packages/](../packages/)、[cli/](../cli/)                                       | CLI/SDK、沙箱和本机模块；现有包名与命令有兼容用途                        |
| [prisma/](../prisma/)                                                            | 沿用本项目迁移历史，不能直接覆盖为上游同序号迁移                         |
| [release-notes/](../release-notes/)、[.github/workflows/](../.github/workflows/) | 包含继承的上游资料；不直接代表 EconoMind 已发布或已验证                  |
| `node_modules/`、`out/`、`dist/`、`test-results/`                                | 依赖、构建和测试生成目录，由忽略规则排除                                 |
| `.dev-isolate/`、`local/`、`.scratch/`                                           | 本地开发数据、工具和临时资料；不应提交，其中的研究数据不应按构建缓存处理 |

根目录保留构建配置和项目治理文件；功能说明与开发指南集中在 `docs/`，完整入口见 [文档索引](README.md)。
