# EconoMind 源码运行指南

EconoMind 的桌面与本地 Web 模式共享 Electron 主进程、数据存储、智能体与模型能力。以下是本仓库的开发与构建入口；外部服务可用性和跨平台运行仍需单独验证。

## 依赖与桌面启动

准备 Node.js 22、npm 和 Git。Windows 本机模块构建还需要 Python 与 Visual Studio C++ Build Tools。

```bash
npm ci
npm run dev
```

独立开发配置方法见 [README](../README.md#独立开发配置powershell)。首次启动通过向导配置数据位置和模型，默认开发配置与安装版配置使用不同目录。

## 本地 Web 模式

```bash
npm run build:web
npm run dev:web
```

`build:web` 生成 API 映射并构建 `out/web/`；`dev:web` 启动 Electron 后端并启用本机 Web 服务，默认服务端口为 `44100`。使用启动日志输出的认证地址访问；端口可通过 `OPEN_SCIENCE_WEB_PORT` 设置。

无头运行开发服务可用 `npm run dev:headless`。主机与后端进程需要持续运行。

Web 界面通过本项目的 RPC、认证与事件接口访问后端。完整系统不能只部署 `out/web/` 静态文件，也不能把其后端请求简单转发到模型供应商接口。公网部署、反向代理和认证适配需要单独设计与验证；本次仓库整理未进行这些部署。

## 构建与定制 Windows 分享包

```bash
npm run build
node scripts/fetch-micromamba.mjs win-64 resources/bin/win/x64/micromamba.exe
node scripts/fetch-micromamba.mjs win-64 resources/bin/win/x64/micromamba-compat.exe compatibility
node packages/notebook-network-sandbox/vendor/windows/build.mjs x64
node node_modules/electron-builder/cli.js --win nsis --x64 --config electron-builder.share.yml --publish never
```

上述命令是 Windows x64 打包入口；沙箱宿主编译还需要 Rust 工具链。先检查资源准备脚本与平台要求，必要的资源路径由 `electron-builder.yml` 声明。本次文档整理未执行打包；安装包需要单独做启动和数据保留验证。分享配置关闭上游更新发布，产物写入 `dist/share/`。

`electron-builder.economind3.yml` 在分享配置上使用 `3.0.0` 安装包标签；这不改变源码版本记录。默认构建配置仍保留上游发布技术参数，详情见 [UPSTREAM.md](../UPSTREAM.md)。

## 研究技能与专家

经管定制的源码包括文献筛选、文献计量、研究设计和计量分析辅助技能，以及 Literature Agent、Methodology Agent、Data Agent、Review Agent 专家角色。具体配置以 `resources/skills/`、`resources/specialists/` 和界面设置为准；需结合真实研究任务验收。

## 验证与记录

按修改范围运行相关测试、类型检查、代码检查和真实页面检查。依赖安装、构建成功、窗口启动、模型请求与业务流程通过是不同的验证结果；记录实际执行的检查和未覆盖的限制。

用户记录、数据库和模型凭据留在本地配置的数据目录；提交源码前检查 [.gitignore](../.gitignore) 和暂存区。
