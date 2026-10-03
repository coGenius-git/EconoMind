# 来源与适配说明

本目录将现成开源研究工作流适配为 EconoMind 中文研究设计与因果识别技能，供内置专家调用。它不是整个上游项目的安装，也不包含其外部工具服务。

## 固定来源

- 上游仓库：[brycewang-stanford/AER-Skills](https://github.com/brycewang-stanford/AER-Skills)
- 固定提交：`85eae99fe5935c79c209f597a56c88899082a090`
- 识别工作流：[skills/aer-identification/SKILL.md](https://github.com/brycewang-stanford/AER-Skills/blob/85eae99fe5935c79c209f597a56c88899082a090/skills/aer-identification/SKILL.md)
- 稳健性工作流：[skills/aer-robustness/SKILL.md](https://github.com/brycewang-stanford/AER-Skills/blob/85eae99fe5935c79c209f597a56c88899082a090/skills/aer-robustness/SKILL.md)
- 上游许可：[LICENSE](https://github.com/brycewang-stanford/AER-Skills/blob/85eae99fe5935c79c209f597a56c88899082a090/LICENSE)，MIT，`Copyright (c) 2026 Bryce Wang`。
- 本地 [LICENSE](LICENSE) 保留上游完整授权和版权文本。

## 改动

1. 将识别选择、按设计诊断、稳健性、异质性、机制及交付流程译写整合为中文，扩大到经管测量、描述、预测、观察性与实验问题；区分目标参数、识别假设和可检验诊断。
2. 删除强制 AER 投稿定位、统一期刊门槛及不可核验的录用暗示。研究者任务与证据决定流程，不要求所有问题先改为准实验。
3. 校正 IV 的统一 F=10/F=50 通过线和 DID 的一概禁止 TWFE/尚未处理对照。强调预趋势不显著不能证明平行趋势，并说明误差结构、弱识别推断及参数解释。
4. 删除所有项目必须完成整套稳健性、固定数量 placebo、任意缩尾/删样本、OLS 无理由换成 IV 等规则；改为威胁驱动、统计目标清晰且有日志的验证。
5. 增加组间差异直接检验、探索与事前计划区分、机制证据层级、原始数据保护及不显著结果的精度解释；不根据一个子组显著而另一个不显著推断异质性。
6. 删除上游 StatsPAI 绑定、未随包提供的相对引用与模板依赖。本文自包含；只保留实际 EconoMind Notebook、包管理与产物导出接口，并要求依据会话工具 schema 调用。
7. 增加授权内写代码、运行、诊断和导出的闭环；明确运行成功、统计有效、文件生成和交付成功是不同状态，不伪造数值或执行记录。

适配日期：2026-10-03。适配文本由 AI 辅助编写，原作者未为本适配提供审查、背书或保证。许可允许使用和修改，不代表方法建议在任何数据情境下都有效。
