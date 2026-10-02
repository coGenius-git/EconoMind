# 上游来源与兼容说明

## 项目关系

[EconoMind](https://github.com/coGenius-git/EconoMind) 基于 [AIPOCH / Open Science](https://github.com/aipoch/open-science) 的源码进行经管领域定制。项目管理、智能体框架、文件与会话存储、Notebook、CLI/SDK 等基础能力大量继承上游。

本地定制包含经管工作台定位、文献筛选、文献计量、研究设计、计量分析相关界面、技能与专家角色。各模块贡献范围需要结合代码差异和提交记录判断，不能仅凭品牌名称认定为全部原创。

初次上传保存的是当时开发工作区的源码快照；本仓库的首次提交日期不是所有代码的创作日期。源码 `package.json` 版本为 `0.27.2`，另有定制 Windows 安装包使用 `3.0.0` 标签。

## 署名与许可

保留 [LICENSE](LICENSE)、源码中的版权说明和各子包、依赖的原有许可。上游作者元数据继续保留；EconoMind 的仓库入口与维护渠道指向本仓库。来源说明不将上游社区、签名、DOI或发布记录表示为 EconoMind 的独立成果。

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

GitHub Actions 当前关闭。上游工作流、默认 `electron-builder.yml` 和 `dev-app-update.yml` 仍包含上游服务、签名或更新源的技术配置；启用独立发布前需要单独适配。本项目 Windows 分享包使用 `electron-builder.share.yml`，其 `publish: null` 关闭上游更新发布。
