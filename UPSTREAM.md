# 上游来源与兼容说明

## 项目关系

[EconoMind](https://github.com/coGenius-git/EconoMind) 基于 [AIPOCH / Open Science](https://github.com/aipoch/open-science) 的源码进行经管领域定制。项目管理、智能体框架、文件与会话存储、Notebook、CLI/SDK 等基础能力大量继承上游。

本地定制包含经管工作台定位、文献筛选、文献计量、研究设计、计量分析相关界面、技能与专家角色。各模块贡献范围需要结合代码差异和提交记录判断，不能仅凭品牌名称认定为全部原创。

初次上传保存的是当时开发工作区的源码快照；本仓库的首次提交日期不是所有代码的创作日期。初始源码版本为 `0.27.2`，另有定制 Windows 安装包使用 `3.0.0` 标签。

2026-10-02 功能适配固定采用上游 main 提交 `c87a5668d6d53d2752ffb46b9f36a307cfca8cb1`（源码版本 `0.34.1`，含该版本发布后的 main 更新）。保留 EconoMind 独立文献库页面、经管筛选、文献计量、项目分类和经管专家；新增功能见 [适配说明](docs/UPSTREAM_FEATURES_20261002.md)。这次源码更新不代表已发布安装包。

EconoMind 已发布的 `0041_project_category` 数据库迁移保持原标识和校验和；新增上游迁移顺延为 `0042`–`0048`。以后更新必须沿用本仓库迁移历史，不能直接替换为上游同名序号。

## 署名与许可

原始 [LICENSE](LICENSE) 完整保留 Apache-2.0 条款及 `Copyright 2026 AIPOCH`。EconoMind 修改部分同样采用 Apache-2.0，版权归相应贡献者；本仓库不将继承的基础代码声明为全部原创。另见 [NOTICE](NOTICE) 与 [开源与第三方说明](docs/OPEN_SOURCE.md)。

`package.json` 的当前维护作者标记为 EconoMind contributors，并在 contributors 中保留 AIPOCH / Open Science 上游来源。源码、各子包与依赖原有的版权及许可说明继续保留。来源说明不将上游社区、签名、DOI 或发布记录表示为 EconoMind 的独立成果，也不表示上游对本项目提供官方认可或支持。

## 保留的兼容名称

| 名称                                           | 保留原因                     |
| ---------------------------------------------- | ---------------------------- |
| `open-science` CLI、`packages/open-science/`   | 命令、SDK 导入和打包路径兼容 |
| `@aipoch/*` 内部包                             | 本机模块和网络沙箱的依赖解析 |
| `OPEN_SCIENCE_*` 环境变量                      | 启动、存储与测试脚本接口兼容 |
| `.open-science*`、`OpenScience-DEV` 等数据名称 | 配置、记录与迁移兼容         |

这些标识属于技术接口，不应仅为文字统一批量替换。单独迁移时需要检查现有记录、CLI 使用方式、打包、测试和依赖。

## 历史参考与自动流程

`release-notes/` 保存继承的历史版本资料；`.github/workflows/` 保存上游构建与自动发布模板，便于技术参考。它们不等于本仓库已发布的版本或已启用的服务。

GitHub Actions 当前关闭。继承的上游工作流、签名脚本及开发参考配置中仍可能包含上游服务；启用独立发布前需要逐项适配。默认 `electron-builder.yml` 和 Windows 分享配置 `electron-builder.share.yml` 均设置 `publish: null`，避免将本项目更新为上游发行包。将来启用自动更新时必须配置并验证 EconoMind 自有发布源。
