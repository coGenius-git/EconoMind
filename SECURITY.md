# EconoMind 安全与问题反馈

EconoMind 是可以调用模型、读写研究文件和执行代码的本地研究工作台。其技术安全边界见 [安全模型](docs/security.md)，上游来源见 [UPSTREAM.md](UPSTREAM.md)。

## 本地记录与凭据

- 项目、会话、文献和生成结果存放在本机配置的数据目录。
- 使用独立开发配置时，记录位于 `.dev-isolate/`，已被 Git 忽略。
- 模型请求、检索或连接器调用可能向所选外部服务传输任务内容；本地存储不代表所有处理都离线。
- 密钥、数据库、真实环境配置与日志不属于可提交的源码。复制数据到新位置后重新检查忽略规则。

## 报告问题

一般问题通过 [本仓库 Issues](https://github.com/coGenius-git/EconoMind/issues) 反馈，提供版本、系统、复现步骤和去除敏感信息后的日志。

疑似漏洞或含私人研究数据的问题，应先与仓库维护者建立私密联系，再传递细节。本项目没有在这里承诺响应时限，也不将上游的安全报告渠道冒充为 EconoMind 的维护渠道。

## 版本与下载

源码版本以 [package.json](package.json) 和提交记录为准。上游安装包、Homebrew 包、DOI、签名或构建证明不能用于证明本仓库产物的版本与真实性。本仓库发布的产物应在 [EconoMind Releases](https://github.com/coGenius-git/EconoMind/releases) 中单独说明来源与校验信息。

运行命令、安装技能、选择外部模型或执行 Notebook 前，检查其文件与网络访问范围；仅在你有权限的系统和数据上验证问题。
