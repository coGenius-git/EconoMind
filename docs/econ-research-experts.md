# 经管研究专家

目前内置五位专家。原经管文献专家拆分为文献查找专家和文献综述专家：查找专家保留 literature-agent ID 和 Literature Agent 英文调用名，已有会话绑定仍可使用；综述专家使用 literature-review-agent ID 和 Literature Review Agent 调用名。菜单显示中文名称。

| 专家             | 工作与主要交付                                         | 绑定技能                                  | 上游                                             |
| ---------------- | ------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------ |
| 文献查找专家     | 明确检索范围、检索日志、筛选表、已核验文献及全文可得性 | econ-literature-evidence                  | AER-Skills / aer-literature                      |
| 文献综述专家     | 文献对比表、论点证据表、带引用的综述及研究定位         | econ-literature-evidence                  | AER-Skills / aer-literature                      |
| 经管研究设计专家 | 构念与变量、识别方案、威胁对应诊断、可执行分析         | econ-causal-design                        | AER-Skills / aer-identification + aer-robustness |
| 经管数据专家     | 主键/合并/缺失/口径审计、清洗副本、代码、样本流转      | econ-data-audit                           | econ-research-skills / data-auditor              |
| 经管研究评审专家 | 定位到原文的问题清单、授权修订、结果复现对账           | econ-research-review + econ-causal-design | AER-Skills / aer-referee-sim + aer-replication   |

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

在项目侧边栏点击「专家」，可以浏览内置和自定义专家、搜索并查看职责、能力及任务示例。详情中的「召唤专家」打开当前项目的新对话草稿并选择该专家；首条消息仍由用户编辑后发送，不会自动创建会话或调用模型。「管理专家」进入现有的专家配置页面。

浏览和召唤会保留原会话草稿。已有的新对话草稿恢复后，空白或未编辑的内置示例可填入新专家示例；用户编辑过的文字、引用和附件不被覆盖。停用、待配置或目录不可用的专家仍可查看，但不能召唤。

从聊天输入框的专家菜单选择角色，对应示例 prompt 会在选择生效后自动填入空白输入框，修改方括号内的主题、范围或材料后发送即可。五个角色目录的 `README.txt` 提供可复制的任务示例。专家会先使用已有材料，仅追问影响研究结论的关键缺口。

本次主要适配包括：

- 把仅面向 AER 的流程扩展为一般经管研究，覆盖问卷、案例、构念测量等场景。
- 分别核验书目存在性、摘要/全文读取和论点支持；不填造引用、数据与结果。
- 纠正统一 IV 阈值、预趋势不显著即通过、机械禁止 TWFE、盲目缩尾和只看子组显著性等规则。
- 以实际证据评审，不强制凑重大问题或模拟录用概率。
- 用户授权时完成综述、代码、清洗与修订副本；保留原始材料，报告真实执行与产物状态。

旧的通用技能继续保留在技能库；五位专家使用上表流程，避免旧模板与新规则同时生效。新增技能没有 `kernel.py`，不应放入 `kernelSkillIds`；它们指导模型发现工具、编写并执行代码。

模型配置、数据库访问、网络和 Python/R 环境仍决定实际任务能否执行。资源注册、技能物化和模拟模型的 Electron 会话回归只能验证接入链路，不能代替真实模型的研究质量评测。

## 示例 prompt 与草稿保护

五位内置专家的示例见 src/renderer/src/pages/workspace/builtin-specialist-examples.ts，八种翻译位于现有 renderer 语言目录。只有用户明确从专家菜单选择或在专家页点击「召唤专家」时填入，不在加载历史会话、接收运行时交接或打开聊天时自动填入。新建会话的选择立即生效；已有会话等待切换完成。未编辑的示例随角色切换替换，切回主智能体时移除；已编辑的草稿、引用和粘贴内容保留。切换失败或等待期间修改了输入框时不覆盖内容。示例不会自动发送，也不会创建会话或调用模型。自定义专家目前没有默认示例。

离开工作区后返回，恢复的未编辑示例仍可随专家选择替换或在切回主智能体时清除。点击“新建对话”会清空新对话草稿，即使当前已经处于新对话页面；从已有会话新建时，原会话草稿仍会保留。

## 2026-10-03 本地验证

- 本次示例残留修复：专家示例、WorkspacePage、草稿控制器和 ConversationPanel 相关测试共 380 项通过；两项实际 Electron 界面用例分别通过，覆盖原有示例切换和草稿保护，以及离开工作区后恢复示例、切换专家、连续新建、返回后旧 prompt 不再恢复。`typecheck:web`、本次改动代码的 Prettier / ESLint 检查和 `build:e2e` 通过。

- 专家注册、ConversationPanel 交互、示例选择与草稿保护、八语言资源检查共 996 项通过；法语格式问题修复后重跑受影响的示例与语言套件通过。
- `npm run build` 通过，包含 Node、Web 和沙箱类型检查，以及 Electron 和 Web 构建。
- `npm run lint` 退出成功，保留仓库已有的 23 条格式警告；本次改动文件的单独 lint 无错误或警告。
- `npx playwright test e2e/builtin-specialists.spec.ts --grep "switches examples"`：1 项真实 Electron 界面测试通过。覆盖五位专家的示例、两个菜单、未编辑示例替换、已编辑草稿保护、切回主智能体清理、中文检索范围与综述显示，以及未自动创建会话。
- 完整专家模型会话及重启恢复测试未完成：本机缺少 Visual Studio C++ 编译环境，普通 `npm ci` 无法构建原生模块；测试应用首次启动可用，配置模拟模型后的重启在 `credential-validation-preflight` 被 `windows-profile-key-unavailable` 阻断。未修改或绕开凭据校验。需要补齐编译环境并完成正常依赖安装后，再运行完整 `e2e/builtin-specialists.spec.ts`。

以上确认角色资源接入和示例交互，不代表真实模型的研究输出质量评测。

## 2026-10-06 主分支与本地功能合并验证

- 合入主分支 `cd14621`、最新研究工作台 UI 和原目录的专家浏览／召唤；保留五位专家、八语言示例、草稿保护，以及主分支的 OpenAlex / PDF 下载逻辑。
- 修复已有会话切换专家时，中间持久化 pending 通知被误判为失败、导致示例请求提前丢弃的问题。成功切换清除该会话旧错误；真实失败仍阻止发送；等待期间用户修改的草稿不被覆盖。
- 27 套相关单元测试共 2085 项通过，其中新增 6 项切换时序回归；类型检查、改动文件 ESLint / Prettier、Electron 构建和锁文件安装一致性检查通过。
- 18 个 Electron 桌面流程完成验证：首轮 16 项通过，两个失败项修复后，与相关示例流程一起复测 4 项全部通过。覆盖五位专家选择、模拟模型会话及重启恢复、专家搜索／召唤／管理、草稿保护、中文与窄屏导航、独立设置窗口、预览收起恢复、页面切换和文献导入。
- 此次专家模型会话及重启验证已通过，更新了上方 2026-10-03 的历史限制。模型输出使用测试服务；尚未进行真实模型的研究质量评测。
