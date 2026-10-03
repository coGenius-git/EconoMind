# 数据审计专家来源与适配记录

## 固定上游

- 原作者：Ninh Nguyen。
- 仓库：[anninhn/econ-research-skills](https://github.com/anninhn/econ-research-skills)。
- 固定提交：`21d16061d6b60f7003678c6579d530a1af03b2c9`。
- 原技能：[`skills/data-auditor/SKILL.md`](https://github.com/anninhn/econ-research-skills/blob/21d16061d6b60f7003678c6579d530a1af03b2c9/skills/data-auditor/SKILL.md)。
- 原始许可：[`LICENSE`](https://github.com/anninhn/econ-research-skills/blob/21d16061d6b60f7003678c6579d530a1af03b2c9/LICENSE)。
- 原技能 Git blob SHA-1：`83866b04d8a1ccd844b4355c65ace8d83e183c74`。
- 原许可 Git blob SHA-1：`b2b15c6e3df467e92d4d7b635def44cc0d473da3`。
- 原技能完整副本：[references/upstream-data-auditor.md](references/upstream-data-auditor.md)；仅用于查验来源，当前执行以本目录 `SKILL.md` 为准。
- 检索与适配日期：2026-10-03。
- 上游采用 MIT，完整许可原样保留在 [LICENSE](LICENSE)。

## 修改说明

当前 `SKILL.md` 是 EconoMind contributors 对上述技能的中文改写和扩展，继续使用 MIT。保留上游的变量可测量性、数据层级、时期、可访问性、数据质量和可继续/有条件/受阻的判断框架。

适配变化：

1. 从固定问卷和“没有数据就停止”改为先读取现有材料、在授权范围内执行审计/清洗；仅暂停确实依赖缺失信息的部分。
2. 删除上游固定数据来源权限表、未核验示例数值和参考文献断言，要求按实际来源页面、字典或持有数据核验。
3. 增加经管数据的主键、缺失键、合并基数、多证券/报表口径、前导零、样本流失、币值/价格基期、存量流量和频率、未来信息污染检查，补充控制变量的因果角色判断。
4. 明确保留原始数据，禁止无依据去重、默认缩尾和显著性驱动清洗；已授权的清洗输出新数据、代码与处理记录。
5. 对接 EconoMind 的 `notebook_execute`、`repl_execute`、`manage_packages` 与 `write_artifact_file`，区分执行成功、生成文件和发布产物。
6. 未导入可执行上游脚本或外部依赖；本技能是工作流指导，没有可调用的数值内核。

上游原文仅作来源留档，不代表当前 EconoMind 的执行规则。该适配不表示上游作者对 EconoMind 的背书。
