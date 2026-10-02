# EconoMind 开发与贡献指南

此指南适用于 [coGenius-git/EconoMind](https://github.com/coGenius-git/EconoMind)。上游来源和兼容约定见 [UPSTREAM.md](UPSTREAM.md)。

## 开发环境

使用 Node.js 22（见 [.nvmrc](.nvmrc)）和 npm。Windows 本机模块编译需要 Python 与 Visual Studio C++ Build Tools。

```bash
git clone https://github.com/coGenius-git/EconoMind.git
cd EconoMind
npm ci
npm run dev
```

`npm ci` 使用锁文件并执行 Prisma Client 生成、依赖补丁和 Electron 本机模块准备。独立开发配置的 PowerShell 示例见 [README](README.md#独立开发配置powershell)。

## 修改范围

- 按问题修改相关模块，保留用户数据和无关改动。
- 保留 `OPEN_SCIENCE_*`、CLI 命令和内部包路径等兼容约定；变更这些接口时单独评估迁移影响。
- 界面与翻译约定见 [AGENTS.md](AGENTS.md)、[设计规范](docs/design.md)和[翻译术语表](docs/i18n-glossary.md)。
- 不将上游实现、历史发布或测试结果描述为 EconoMind 团队新开发或新验证的成果。

## 验证

按修改的实际影响选择检查：

```bash
npm test -- <相关测试文件>
npm run typecheck
npm run lint
```

界面修改检查真实页面；数据、权限和执行流程修改检查相应行为；文档修改检查内容、链接和命令与源码的一致性。只报告实际运行过的检查。

## 提交与反馈

提交说明写清问题、改动、验证和限制。Issue 与 PR 使用本仓库的入口，合并、发布和自动流程由仓库维护者决定。GitHub Actions 当前关闭，保留的上游工作流不是已启用的本项目发布服务。

提交前检查 `git status` 和暂存区，确认没有个人研究记录、模型凭据、日志或数据库。[.gitignore](.gitignore) 不会自动移除已经跟踪的敏感文件。

## 许可

贡献沿用项目的 [Apache-2.0 许可证](LICENSE)。保留被修改或复用文件的原有署名与许可说明。
