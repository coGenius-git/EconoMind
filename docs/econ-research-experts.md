# 经管研究专家

四位内置专家在 1.1.0 版中接入了 GitHub 开源研究工作流。稳定专家 ID 和英文调用名保持不变，已有会话绑定可继续使用。菜单显示中文名称。

| 专家             | 工作与主要交付                                       | 绑定技能                                  | 上游                                             |
| ---------------- | ---------------------------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| 经管文献专家     | 检索日志、筛选表、近邻文献与论点证据表、有引用的综述 | econ-literature-evidence                  | AER-Skills / aer-literature                      |
| 经管研究设计专家 | 构念与变量、识别方案、威胁对应诊断、可执行分析       | econ-causal-design                        | AER-Skills / aer-identification + aer-robustness |
| 经管数据专家     | 主键/合并/缺失/口径审计、清洗副本、代码、样本流转    | econ-data-audit                           | econ-research-skills / data-auditor              |
| 经管研究评审专家 | 定位到原文的问题清单、授权修订、结果复现对账         | econ-research-review + econ-causal-design | AER-Skills / aer-referee-sim + aer-replication   |

## 来源与许可

这是上游工作流的中文改编和 EconoMind 接入，不是安装整个外部智能体系统。没有引入上游的执行器、统计算法库或外部服务；实际运行使用软件已有的模型、连接器和 Notebook。

- [brycewang-stanford/AER-Skills](https://github.com/brycewang-stanford/AER-Skills/tree/85eae99fe5935c79c209f597a56c88899082a090)：固定提交 `85eae99fe5935c79c209f597a56c88899082a090`，MIT，Copyright (c) 2026 Bryce Wang。
- [anninhn/econ-research-skills](https://github.com/anninhn/econ-research-skills/tree/21d16061d6b60f7003678c6579d530a1af03b2c9)：固定提交 `21d16061d6b60f7003678c6579d530a1af03b2c9`，MIT，Copyright (c) 2025 Ninh Nguyen。

每个新技能目录的 `SOURCE.md` 记录精确原文件与修改，`LICENSE` 保留完整许可。中文角色配置、运行工具适配与补充流程由 EconoMind contributors 使用 AI 辅助编写；上游作者未为本适配背书。

- [文献技能及来源](../resources/skills/econ-literature-evidence/SOURCE.md)
- [研究设计技能及来源](../resources/skills/econ-causal-design/SOURCE.md)
- [数据技能及来源](../resources/skills/econ-data-audit/SOURCE.md)
- [评审技能及来源](../resources/skills/econ-research-review/SOURCE.md)

## 适配与使用

从聊天输入框的专家菜单选择角色，直接提供研究问题或文件。四个角色目录的 `README.txt` 提供可复制的任务示例。专家会先使用已有材料，仅追问影响研究结论的关键缺口。

本次主要适配包括：

- 把仅面向 AER 的流程扩展为一般经管研究，覆盖问卷、案例、构念测量等场景。
- 分别核验书目存在性、摘要/全文读取和论点支持；不填造引用、数据与结果。
- 纠正统一 IV 阈值、预趋势不显著即通过、机械禁止 TWFE、盲目缩尾和只看子组显著性等规则。
- 以实际证据评审，不强制凑重大问题或模拟录用概率。
- 用户授权时完成综述、代码、清洗与修订副本；保留原始材料，报告真实执行与产物状态。

旧的通用技能继续保留在技能库；四专家改用上表流程，避免旧模板与新规则同时生效。新增技能没有 `kernel.py`，不应放入 `kernelSkillIds`；它们指导模型发现工具、编写并执行代码。

模型配置、数据库访问、网络和 Python/R 环境仍决定实际任务能否执行。资源注册、技能物化和模拟模型的 Electron 会话回归只能验证接入链路，不能代替真实模型的研究质量评测。
