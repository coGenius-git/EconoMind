---
name: econometrics-assistant
description: >-
  计量分析助手（Econometrics Assistant）：面向经管实证研究，提供描述统计、
  相关矩阵、回归模型建议与结果解读模板；生成可运行的 Python
  （pandas / numpy / statsmodels / sklearn）或 R（plm / lme4）代码模板与
  解读清单。辅助研究者完成计量分析，不替代研究者做最终统计判断。
---

# 计量分析助手

## 定位

经管实证研究的计量辅助：从**数据结构与研究问题**出发，输出
（1）描述统计与相关分析代码模板；（2）回归模型建议与设定理由；
（3）结果解读清单。产物可直接在 notebook 内核 / 本地 Python / R 环境运行。

## 输入

- `dependent`：因变量（Y）。
- `independents`：核心自变量列表（X）。
- `panel`（可选）：是否为面板数据（`panel=true` + `unit`/`time` 字段名）。
- `method`（可选）：研究者偏好方法（OLS / FE / RE / DID / IV / Logit 等）。
- `data_frame`（可选）：数据表描述（列名 + 类型）。

## 输出

- `suggest_model(...)`：模型建议（模型类别、设定理由、适用前提、备选）。
- `code_templates(...)`：`python`（statsmodels）与 `r`（plm / lme4）代码模板。
- `interpretation_template(...)`：结果解读清单（系数方向 / 显著性 / 经济含义 /
  稳健性检查）。
- `econometrics_markdown(...)`：可落盘的 `.md` 分析建议文档。

## 关键约定

- **不编造数据**：代码模板使用占位列名，不假设任何真实数据存在。
- **不替代统计判断**：模型建议是"建议"；显著性、因果识别与稳健性由研究者
  依据数据与识别策略自行判断。
- **可复核**：每个建议都给出适用前提与备选方案；模板注明所需包与安装方式。
- 支持中文与英文输入，输出保留输入语言。
