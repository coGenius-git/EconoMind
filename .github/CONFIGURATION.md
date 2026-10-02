# EconoMind 仓库配置

Issue 模板与文档入口适用于 [coGenius-git/EconoMind](https://github.com/coGenius-git/EconoMind)。

`workflows/` 和 `action/` 保留继承上游的自动构建、审查和发布实现，便于代码参考及现有测试读取。GitHub Actions 当前关闭，这些文件不代表 EconoMind 已启用自动发布、签名、npm 发布、网站镜像或上游账号服务。

启用流程前，应逐项适配仓库、运行条件、权限、密钥、服务目标、签名与发布渠道；不能只改显示名称后直接复用上游发布配置。来源与范围见 [UPSTREAM.md](../UPSTREAM.md)。
