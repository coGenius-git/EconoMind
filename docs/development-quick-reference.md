# EconoMind 开发命令速查

完整环境准备见 [项目首页](../README.md#快速开始)，代码入口见 [源码导航](CODEBASE.md)。下列命令在仓库根目录执行，定义以 [package.json](../package.json) 为准。

## 首次启动（Windows）

准备 Node.js 24.x、npm、Git、Python、Visual Studio C++ Build Tools 和 Rust MSVC 工具链。

```powershell
git clone https://github.com/coGenius-git/EconoMind.git
cd EconoMind
npm ci
npm run build:notebook-host
npm run dev:isolated
```

开发数据保存在 `.dev-isolate/`。更新源码时保留数据；依赖或锁文件改变后重新 `npm ci`，Windows 沙箱宿主源码改变后重新构建宿主。

## 检查与构建

| 命令                                                        | 用途                                          |
| ----------------------------------------------------------- | --------------------------------------------- |
| `npm run typecheck`                                         | 检查主进程、沙箱与界面类型                    |
| `npm run lint`                                              | ESLint 检查                                   |
| `npm test -- src/main/research-tools/bibliometrics.test.ts` | 指定模块测试示例，按修改范围替换路径          |
| `npm test -- --maxWorkers=2`                                | 全量单元与组件测试，限制并发                  |
| `npm run build`                                             | 类型检查并构建应用及 Web 资源                 |
| `npm run build:e2e`                                         | 构建 Electron 端到端测试所需应用              |
| `npm run test:e2e`                                          | Playwright 应用测试；先准备对应平台与测试环境 |
| `npm run build:web`                                         | 构建本地 Web 界面                             |
| `npm run dev:web`                                           | 启动桌面后端和本地 Web 服务                   |
| `npm run dev:headless`                                      | 启动无桌面窗口的开发后端与 Web 服务           |

构建和检查前先关闭开发窗口、结束开发进程，避免同时写入输出目录。选择与变更有关的检查，如实记录失败和未验证项。

`npm run build` 不生成安装包。Windows 分享包的资源下载、宿主准备和关闭发布的打包命令见 [运行与打包指南](DEPLOY.md)。Web 服务依赖后端进程持续运行，认证地址不要写入提交或截图。

[开发约定](../CONTRIBUTING.md) · [团队 Git / PR 流程](TEAM_GUIDE.md) · [文档索引](README.md)
