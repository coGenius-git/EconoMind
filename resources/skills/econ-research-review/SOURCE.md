# 研究评审专家来源与适配记录

## 固定上游

- 原作者：Bryce Wang。
- 仓库：[brycewang-stanford/AER-Skills](https://github.com/brycewang-stanford/AER-Skills)。
- 固定提交：`85eae99fe5935c79c209f597a56c88899082a090`。
- 评审工作流：[skills/aer-referee-sim/SKILL.md](https://github.com/brycewang-stanford/AER-Skills/blob/85eae99fe5935c79c209f597a56c88899082a090/skills/aer-referee-sim/SKILL.md)。
- 复现工作流：[skills/aer-replication/SKILL.md](https://github.com/brycewang-stanford/AER-Skills/blob/85eae99fe5935c79c209f597a56c88899082a090/skills/aer-replication/SKILL.md)。
- 原始许可：[MIT LICENSE](https://github.com/brycewang-stanford/AER-Skills/blob/85eae99fe5935c79c209f597a56c88899082a090/LICENSE)，完整原文保存在本目录 [LICENSE](LICENSE)。
- 检索与适配日期：2026-10-03。

## 修改说明

本目录是 EconoMind contributors 对上述两个技能的中文改写和整合，继续使用 MIT。保留上游的识别、领域贡献、一般读者三个互补评审视角，以及以具体证据支持意见、逐项给出修订路径、建立数据和代码来源记录、比较生成结果与稿件结果的核心流程。

主要适配如下：

1. 从仅针对完整 AER 投稿稿件的模拟评审扩展到一般经济学与管理学研究，支持开题、部分章节、图表、定性研究、理论研究和代码审查；不将缺少完整稿件视为自动失败。
2. 去除预设拒稿、每位评审至少三个重大问题、主观分数决定通过、推断接收率和反复模拟直到通过的要求。结论按实际证据和检查范围给出，缺失输入与已发现错误分开。
3. 增加构念测量、研究层级、因果/预测/描述区分、合理解释不显著结果、样本流转及图文数字一致性检查，防止通过挑选显著结果回应评审。
4. 保留数据原件和既有结果；授权修订时完成修订副本，未授权修改时只评审。可复现审计按任务深度执行，明确区分静态审查、实际运行、部分复现与受阻。
5. 删除固定 AEA 政策和格式断言、上游文档/模板的未随包导入引用，以及未提供的工具依赖。特定投稿政策仅在用户目标明确时向当前正式来源核验。
6. 对接 EconoMind 的 `notebook_execute`、`repl_execute`、`manage_packages` 和 `write_artifact_file`。未导入数值算法、可执行上游脚本或新的外部运行时。

上游文字中的示例、期刊政策和模拟审稿判断不代表当前软件的事实保证；该适配不表示原作者对 EconoMind 的背书。
