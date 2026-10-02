# 协作准备检查记录

检查日期：2026-10-02。检查对象：`coGenius-git/EconoMind` 的远程 `main`（基线 `f2747c1`）及本次协作准备修改。

## 环境与方法

- Windows x64，官方 Node.js **22.23.3**、npm **10.9.9**；使用便携版环境，下载包经官方 SHA-256 校验。
- 已安装 Python 3 与 Visual Studio 2022 C++ Build Tools。
- 先从私有 GitHub 仓库全新克隆，执行 `npm ci`，没有复制现有 `node_modules`、配置、数据库或环境文件。
- 修改锁文件后，在另一份全新 checkout 再次 `npm ci`。下载缓存可复用，安装目录与开发数据均独立。
- 本机下载需要已有网络代理。这是验证机器的网络条件，没有将代理配置写入仓库；队友仍需自己的网络和私有仓库权限。

## 已完成的修复与清理

1. 修复 `e2e/economind-workbench.spec.ts` 对可选 `notebookNetwork` 的访问。原先会使 `npm run typecheck` / `npm run build` 失败；可选访问后，缺失设置仍会使原有 `toContain` 断言失败，不会掩盖功能错误。
2. 增加 `npm run dev:isolated`，将开发数据固定放在忽略的 `.dev-isolate/`，清理继承的 `ELECTRON_RUN_AS_NODE`，保留后续启动的数据。
3. 为 ESLint / Prettier / Vitest 排除 `.dev-isolate/`，避免本地日志、配置或研究工作区内的测试文件进入源码检查。
4. 修复既有 CommonJS 打包脚本的 lint 规则不适配，并格式化两份原有测试，不改变其行为。
   同步文献筛选接口清单、当前 GitHub 反馈地址、经管域名、禁用 Remote 入口和 Settings 依赖边界的旧断言；对比度测试改为解析实际 CSS 变量和十六进制颜色，仍保持 WCAG AA 对比度要求。
5. 删除下表所列的闲置代码。判断依据包括 TypeScript 模块引用、全文引用、HTML / 构建入口和现有页面路由；测试辅助文件、Worker 入口、兼容后端和翻译保留资产未按“无普通 import”简单删除。

| 删除内容                                                       | 依据                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/renderer/src/components/Versions.tsx`                     | 无源码导入或入口，是未使用的版本展示组件                               |
| `src/renderer/src/components/ui/hover-card.tsx`                | 无使用者的组件封装                                                     |
| `src/renderer/src/pages/settings/AppIconSection.tsx`           | 定制版设置不再提供图标切换入口，仅旧组件测试引用                       |
| `src/renderer/src/pages/settings/RemoteControlPanel.tsx`       | 定制版设置不提供 Remote 入口，仅旧组件测试引用                         |
| `src/renderer/src/pages/workspace/message-draft-keyboard.ts`   | 当前会话编辑器不使用此 helper，仅它自己的测试引用                      |
| `src/renderer/src/stores/project-background-activity-store.ts` | 没有业务消费者，仅自己的测试引用                                       |
| 上述旧模块的 4 份专用测试，以及 General 测试中旧图标段落       | 随已删除模块清理；保留当前 Settings、命令路由与 About 的实际测试       |
| `3dmol`、`openchemlib`                                         | 当前源码已无相应科学结构查看器或依赖引用，npm 同步移除依赖和锁文件条目 |

随删除的界面清理八个语言目录中各 **67** 条不再使用的翻译，并移除仅针对已删除文字的术语断言。德语 README 的测试由上游完整产品介绍断言改为检查本仓库摘要的有效链接、来源、版本与启动指令。

保留 Apache-2.0 许可、上游署名、迁移、依赖补丁、网络沙箱、本机模块、CLI/SDK 和仍被协议/后端使用的代码。远程访问后端目前未启用，仍有兼容与测试用途；保留并注明状态，不因前端入口已删除就连带删除。

## 验证结果

| 检查                                    | 结果                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 远程基线全新 `npm ci`                   | 通过，安装 1618 个包，补丁、Prisma 与 Electron 本机模块步骤完成                                            |
| 最终锁文件全新 `npm ci`                 | 通过，安装 1611 个包；无需模型凭据或个人配置才能安装                                                       |
| `npm run build`                         | 通过，含主进程、沙箱、界面类型检查与 Electron/Web 构建                                                     |
| `npm run lint`                          | 通过                                                                                                       |
| 翻译保护测试                            | 通过，797 条断言                                                                                           |
| Vitest 配置测试                         | 通过，19 条断言；开发数据目录已排除                                                                        |
| 最终干净副本的相关回归测试              | 7 个文件、979 条断言通过；另 9 个定制版契约测试文件、176 条断言通过                                        |
| `npm run dev:isolated` 实际启动与数据库 | 通过，进入首次设置界面，数据库 `ready`、项目列表可读取，必需环境检查就绪；页面重载未捕获脚本错误           |
| 远程基线全量 Vitest                     | **未通过**：1536 个文件中 44 个失败；27764 条断言通过、94 条失败、570 条跳过、2 条 pending。命令退出码为 1 |
| 原先失败文件在最终源码中的复查          | **未通过**：44 个文件中 14 个通过、30 个失败；2648 条断言通过、68 条失败、37 条跳过。命令退出码为 1        |

安装仍有依赖 peer / deprecated 警告，构建仍有大 chunk、CSS 或依赖 externalization 提示；本次成功命令退出码为 0，没有以屏蔽日志方式消除警告。

初次启动验证时，在机器同时执行大量测试的情况下，Vite 首次预构建较慢，15 秒的界面等待超时；随后实际界面出现，延长验证等待并重新加载后检查通过。安装工具齐全与代码可构建，不代表首次启动所有依赖都即时就绪。

### 全量失败的初步分类

- 本机权限：多个安全测试创建符号链接时出现 `EPERM`；部分文件替换/重命名也出现 Windows 权限或竞争错误。没有为测试修改系统安全设置或跳过相关测试。
- Linux CI 环境：Bash 工作流测试使用 Linux shell / `jq` 等工具，本机解析到 WSL Bash，出现路径或缺少 `jq` 的错误。
- 打包前置资源：沙箱资源测试查找未随源码提交的 Windows x64/arm64 主机二进制。这些文件应按打包流程生成，普通开发启动已单独验证。
- 定制后的旧断言：文献筛选接口、Remote 面板、来源文档、反馈仓库、域名与 CSS 格式，已按当前实际行为修正并复查。
- 其余需要单独诊断：Notebook 运行时、包变更、文件观察、模型/智能体集成、Office 首屏等仍有原有失败或平台假设。不能将它们全部归因于环境，也不能宣称全量功能已通过。

### 最终源码的失败文件复查

在最终干净副本设置 `VITEST_WINDOWS_FULL_TEST=1`，仅对原先失败的 44 个文件使用单 worker 复查，结果如下。**这不是对最终源码再次执行全部 1536 个文件**；14 个文件转为通过同时受本次旧断言修正、单 worker 与超时预算影响，不能把全部差额都归为代码修复。

| 仍失败的测试文件                                                  | 失败断言数 |
| ----------------------------------------------------------------- | ---------: |
| `scripts/ai-review-workflows.test.ts`                             |         13 |
| `scripts/ci/pr-gate-workflow.test.ts`                             |          2 |
| `src/main/logger.test.ts`                                         |          1 |
| `packages/notebook-network-sandbox/src/resources.test.ts`         |          2 |
| `packages/notebook-network-sandbox/src/runtime-config.test.ts`    |          1 |
| `src/main/acp/file-reference-resolver.test.ts`                    |          1 |
| `src/main/compute/compute-probe-script.test.ts`                   |          1 |
| `src/main/compute/harvest-engine.test.ts`                         |          1 |
| `src/main/literature/pdf-attachment-reliability.test.ts`          |          2 |
| `src/main/local-fs/service.test.ts`                               |          2 |
| `src/main/notebook/host-view-image-service.test.ts`               |          1 |
| `src/main/notebook/micromamba.test.ts`                            |          2 |
| `src/main/notebook/package-manager.test.ts`                       |          1 |
| `src/main/notebook/process-environment.test.ts`                   |          1 |
| `src/main/notebook/provisioner-runtime.test.ts`                   |          1 |
| `src/main/notebook/runtime-service.test.ts`                       |          2 |
| `src/main/notebook/working-file-observer.test.ts`                 |          5 |
| `src/main/settings/notebook-network-settings.test.ts`             |          1 |
| `src/main/settings/service.test.ts`                               |          9 |
| `src/main/skills/registered-helper-catalog.test.ts`               |          1 |
| `src/main/skills/runtime-mcp-server.test.ts`                      |          2 |
| `src/main/skills/user-skill-repository.test.ts`                   |          1 |
| `src/main/storage/content-repository.test.ts`                     |          1 |
| `src/main/storage/data-migration.test.ts`                         |          6 |
| `src/main/storage/migration-service.test.ts`                      |          3 |
| `src/main/uploads/attachment-media.test.ts`                       |          1 |
| `src/main/uploads/repository.test.ts`                             |          1 |
| `src/renderer/src/pages/workspace/workspace-components.test.tsx`  |          1 |
| `src/main/acp/codex-completion-handoff.integration.test.ts`       |          1 |
| `src/main/agent-framework/claude-code-memory.integration.test.ts` |          1 |

复查仍出现符号链接/替换文件的 `EPERM`、Linux shell 输出、缺少沙箱主机打包资源、跨平台路径与旧布局源码断言。另有运行时取消/释放、网络策略、批准后的专家身份交接、模型自动记忆隔离等功能相关断言失败，尚未完成根因诊断与真实操作复现；不能以安装和启动成功推断这些行为正确。

需要继续诊断时，先设置 `$env:VITEST_WINDOWS_FULL_TEST = '1'`，再运行 `npm test -- 上表中的实际文件路径`。保留原断言，分别验证运行环境、测试假设与实现。原始日志含本机路径，仅留在本地，没有提交到仓库。

## 验证边界

本次验证开发准备与源码运行，不等于所有功能在所有机器均无错误。未完成 macOS/Linux 实机验证、正式安装包制作/升级测试、全部 Playwright E2E 和配置真实凭据后的外部模型/知网调用。API、账号权限、网络、原生编译工具与运行时安装仍取决于队友的机器及服务配置。

团队分工是计划，尚未实施的功能不能按本记录标为完成。GitHub Actions 当前关闭，队友通过 PR 提交本地检查结果，再由维护者审查合并。
