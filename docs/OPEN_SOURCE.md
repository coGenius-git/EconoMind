# EconoMind 开源许可与二次开发说明

<!-- Modified by EconoMind contributors: attribution, distribution and README presentation guidance. -->

EconoMind 基于 **AIPOCH Open Science** 修改和扩展，面向经济学、管理学、金融学与会计学研究。项目采用 **Apache License 2.0（Apache-2.0）**；英文完整条款以随软件提供的 LICENSE 为准。本说明用于介绍来源与许可范围，不替代或修改许可证。

## 来源、版权与项目关系

- 上游项目：https://github.com/aipoch/open-science
- EconoMind 项目：https://github.com/coGenius-git/EconoMind
- 原始版权声明：Copyright 2026 AIPOCH。
- EconoMind 修改部分：Copyright 2026 EconoMind contributors，继续采用 Apache-2.0。
- 当前适配基线：上游提交 `c87a5668d6d53d2752ffb46b9f36a307cfca8cb1`，源码版本 `0.34.1`。

项目管理、智能体运行框架、文件与会话存储、Notebook、CLI/SDK 等基础能力大量继承自 Open Science。EconoMind 的修改包括经管工作台、文献筛选与观点提取、文献计量、项目分类、经管技能与专家、界面和品牌适配、移除市场及远程访问功能，以及工作流可靠性修复。具体范围结合 UPSTREAM.md、适配记录与代码差异判断；本项目不声明全部代码为原创。

EconoMind 独立维护，并非 AIPOCH 官方发行版。上游名称仅用于准确说明来源，不表示官方合作、认可或支持。Apache-2.0 不授予上游商标或产品名称的使用权；原始版权、来源署名和第三方许可不会因界面品牌调整而删除。

## 使用、修改和再分发

Apache-2.0 允许在其条款下使用、修改及分发软件，包括商业使用。再分发时应保留完整许可证、适用的原始版权和署名，并使修改文件带有显著的修改说明；随本项目提供 NOTICE。完整义务、专利授权及限制、免责声明等均以 LICENSE 为准。

### README 展示与许可声明

2026-10-30 核对本项目适配基线的 [LICENSE](https://github.com/aipoch/open-science/blob/c87a5668d6d53d2752ffb46b9f36a307cfca8cb1/LICENSE) 与 [Apache-2.0 官方条款](https://www.apache.org/licenses/LICENSE-2.0)：许可证未要求在 README 的产品介绍中展示上游名称、标志或宣传链接。本项目 README 聚焦 EconoMind，提供 LICENSE 与 NOTICE 入口；来源、版权与修改说明保存在许可和来源文件中。

这不免除第 4 条的再分发义务：向接收方提供许可证副本；使修改文件带有显著修改说明；在分发的源码中保留适用的版权、专利、商标及署名声明；如果所用上游分发包含 NOTICE，则按第 4(d) 条保留其中适用的声明。不能把“README 无需品牌展示”理解为可以删除源码中已有的适用声明。

所核对基线的仓库根目录未包含 NOTICE；本项目现有 NOTICE 用于集中说明来源和修改。第 6 条不授予一般性的上游商标使用权，仅保留说明来源、复现 NOTICE 等合理惯常用途。这里核对的是 README 展示方式与许可条款，不构成对全部源码、依赖和发行包的合规审计。

### 文件修改说明

修改代码时可在文件开头使用适合该文件语法的注释，例如：

```text
Modified by EconoMind contributors: <brief description of changes>.
Based on AIPOCH Open Science; see LICENSE and NOTICE.
```

不得覆盖原有版权头。对不支持注释的 JSON、二进制资源等，需采用适合交付格式的随附修改记录，保留原始文件及出处信息。集中记录有助于追踪来源，不应据此省略可添加的文件内修改说明。发布时应按实际源码差异和所含资源核对声明。

用户导入的论文、数据、模型输出及外部服务内容不因使用本软件而自动适用本项目许可证，其权利由相应权利人和适用条款决定。

## 第三方组件和资源

依赖包、内置或按需下载的模型、图标、字体、技能及其他资源可能采用独立许可证。应保留各自的 LICENSE、NOTICE、COPYING 和版权说明；不能将本项目的 Apache-2.0 标签理解为这些材料全部采用同一许可证。

本项目已明确保留的示例包括：

- LobeHub 提供商图标：MIT；源码中的 `src/renderer/src/assets/provider-icons/LobeHub-icons-LICENSE` 会随桌面软件提供。
- 继承的 `packages/open-science` CLI/SDK：保留其 Apache-2.0 LICENSE 与兼容名称。
- 可选 PDF 图表解析模型：界面保留 Microsoft Table Transformer 来源；模型和运行依赖以各自分发材料中的许可证为准。

这份说明不是全部依赖和资源的逐项许可证审计报告。后续发行应核对实际打包内容及新增、升级依赖的许可；软件保留的第三方许可文件是相应声明的一部分。

## 随软件提供的文件

设置 → 通用 → 开源许可证可离线查看许可及本说明。桌面发行配置同时将以下文件复制到应用的 resources 目录，便于直接阅读：

- `LICENSE.txt`：完整 Apache-2.0 条款及原始 AIPOCH 版权声明。
- `NOTICE.txt`：原始项目、EconoMind 修改署名及修改范围。
- `UPSTREAM.md`：适配来源与内部兼容名称。
- `OPEN_SOURCE.md`：本说明。
- `LobeHub-icons-LICENSE`：第三方图标 MIT 许可。

源码中对应位置为根目录 LICENSE、NOTICE、UPSTREAM.md 与 `docs/OPEN_SOURCE.md`。既有安装包不会因修改源码自动更新，发行时需从当前源码重新构建。

## 权威参考

- Open Science 原始许可证：https://github.com/aipoch/open-science/blob/main/LICENSE
- Apache License 2.0 官方条款：https://www.apache.org/licenses/LICENSE-2.0

本说明的中文内容便于阅读，Apache 许可证以其英文正文为准。
