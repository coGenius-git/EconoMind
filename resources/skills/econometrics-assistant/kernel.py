"""Econometrics assistant kernel for the `econometrics-assistant` skill.

Pure Python standard library. Produces model suggestions, runnable code
templates (Python statsmodels / R plm & lme4), and an interpretation checklist.
All column names in generated code are placeholders derived from the input;
the kernel never fabricates data or statistical results.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

_CLEAN_RE = re.compile(r"[^\w\u4e00-\u9fff]")


def _safe_column(name: str, fallback: str) -> str:
    cleaned = _CLEAN_RE.sub("_", (name or "").strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if not cleaned or cleaned[0].isdigit():
        return fallback
    return cleaned


def suggest_model(
    dependent: str,
    independents: List[str],
    panel: bool = False,
    method: Optional[str] = None,
) -> Dict[str, Any]:
    """Suggests an econometric model class with rationale and alternatives."""
    y = _safe_column(dependent, "y")
    xs = [_safe_column(x, f"x{index}") for index, x in enumerate(independents, start=1)]
    method_key = (method or "").strip().upper()

    candidates: List[str] = []
    if method_key in ("OLS", "LM", "MULTIPLE"):
        candidates = ["普通最小二乘（OLS）"]
    elif method_key in ("FE", "FIXED"):
        candidates = ["面板固定效应（FE）"]
    elif method_key in ("RE", "RANDOM"):
        candidates = ["面板随机效应（RE）"]
    elif method_key in ("DID", "DIDDID", "DIFF_IN_DIFF"):
        candidates = ["双重差分（DID）"]
    elif method_key in ("IV", "2SLS", "TSLS"):
        candidates = ["工具变量 / 两阶段最小二乘（IV/2SLS）"]
    elif method_key in ("LOGIT", "PROBIT", "LOGISTIC"):
        candidates = ["二元选择模型（Logit/Probit）"]
    elif panel:
        candidates = ["面板固定效应（FE，组内估计）", "面板随机效应（RE，GLS）"]
    else:
        candidates = ["普通最小二乘（OLS）"]

    rationale: List[str] = []
    if len(candidates) == 1 and candidates[0] == "普通最小二乘（OLS）":
        rationale.append("横截面数据且无明显的组内结构时，OLS 是起点；需检验多重共线性（VIF）与异方差（稳健标准误）。")
    if any("固定效应" in candidate for candidate in candidates):
        rationale.append("面板数据首选 FE 以吸收不随时间变化的单位异质性；Hausman 检验可在 FE 与 RE 间取舍。")
    if any("DID" in candidate for candidate in candidates):
        rationale.append("DID 需要平行趋势假设；建议附事件研究图与安慰剂检验。")
    if any("IV" in candidate for candidate in candidates):
        rationale.append("IV 需满足相关性与外生性；请报告第一阶段 F 统计量与弱工具变量检验。")
    if method_key and not candidates:
        rationale.append(f"未能识别方法「{method}」，已给出通用建议，请研究者确认设定。")
    if not rationale:
        rationale.append("方法由研究者依据研究问题与数据结构确认；本建议仅供参考。")

    return {
        "dependent": y,
        "independents": xs,
        "candidates": candidates,
        "rationale": rationale,
        "panel": panel,
    }


def code_templates(
    dependent: str,
    independents: List[str],
    panel: bool = False,
    unit: Optional[str] = None,
    time: Optional[str] = None,
) -> Dict[str, str]:
    """Returns runnable Python (statsmodels) and R (plm/lme4) templates."""
    y = _safe_column(dependent, "y")
    xs = [_safe_column(x, f"x{index}") for index, x in enumerate(independents, start=1)]
    formula = f"{y} ~ " + " + ".join(xs)
    unit_col = _safe_column(unit or "", "unit")
    time_col = _safe_column(time or "", "time")

    python_lines = [
        "# 依赖：pip install pandas numpy statsmodels",
        "import pandas as pd",
        "import statsmodels.api as sm",
        "from statsmodels.formula.api import ols",
        "",
        "# df 为你的数据表（列名与下方占位一致）",
        "df = pd.read_csv('your_data.csv')",
        f"model = ols('{formula}', data=df).fit(cov_type='HC1')",
        "print(model.summary())",
        "",
        "# 共线性检查",
        "from statsmodels.stats.outliers_influence import variance_inflation_factor",
        "X = sm.add_constant(df[%r])" % xs,
        "vif = {name: variance_inflation_factor(X.values, i) for i, name in enumerate(X.columns)}",
        "print('VIF:', vif)",
    ]
    if panel:
        python_lines = [
            "# 依赖：pip install pandas numpy statsmodels linearmodels",
            "import pandas as pd",
            "import statsmodels.api as sm",
            "from linearmodels.panel import PanelOLS, RandomEffects",
            "",
            "df = pd.read_csv('your_panel_data.csv')",
            f"df = df.set_index(['{unit_col}', '{time_col}'])",
            f"X = sm.add_constant(df[{xs}])",
            f"fe = PanelOLS(df['{y}'], X, entity_effects=True).fit(cov_type='clustered', cluster_entity=True)",
            "print(fe.summary)",
            "re = RandomEffects(df['%s'], X).fit()" % y,
            "print(re.summary)",
        ]

    r_lines = [
        "# 依赖：install.packages(c('plm','lmtest','sandwich','lme4'))",
        "library(plm)",
        f"df <- read.csv('your_data.csv')",
        f"pdata <- pdata.frame(df, index = c('{unit_col}', '{time_col}'))" if panel
        else "pdata <- df",
        "",
        f"fe <- plm({formula}, data = pdata, model = 'within')",
        "summary(fe)",
        "phtest(fe, plm(%s, data = pdata, model = 'random'))" % formula,
        "",
        "# 稳健标准误",
        "library(lmtest); library(sandwich)",
        "coeftest(fe, vcov = vcovHC(fe, type = 'HC1'))",
    ]
    if panel:
        r_lines.append("")
        r_lines.append("# 或使用 lme4 混合效应模型")
        r_lines.append("library(lme4)")
        r_lines.append(f"m <- lmer({y} ~ " + " + ".join(xs) + f" + (1 | {unit_col}), data = pdata)")
        r_lines.append("summary(m)")

    return {"python": "\n".join(python_lines), "r": "\n".join(r_lines)}


def interpretation_template(dependent: str, independents: List[str]) -> List[str]:
    """Returns a result interpretation checklist."""
    return [
        "1. 系数方向：核心自变量系数是否符合理论预期方向？",
        "2. 显著性：报告系数、标准误与 p 值；区分统计显著与经济显著。",
        "3. 经济含义：用标准差或弹性解读系数大小（如 X 提高一个标准差，Y 变化多少）。",
        "4. 模型诊断：多重共线性（VIF）、异方差（稳健标准误）、遗漏变量与反向因果。",
        "5. 稳健性：更换变量测度 / 样本区间 / 估计方法（FE↔RE、聚类标准误）后结论是否稳定。",
        "6. 因果识别：区分相关与因果；如使用 IV/DID，报告识别假设与检验。",
        "7. 结果呈现：将系数、标准误、显著性星号整理为三线表，标注数据来源与样本量。",
    ]


def econometrics_markdown(
    dependent: str,
    independents: List[str],
    panel: bool = False,
    method: Optional[str] = None,
) -> str:
    """Renders a `.md` analysis suggestion document."""
    suggestion = suggest_model(dependent, independents, panel, method)
    templates = code_templates(dependent, independents, panel)
    lines = ["# 计量分析建议", ""]
    lines.append("## 模型建议")
    lines.append("、".join(suggestion["candidates"]))
    lines.append("")
    lines.append("**设定理由**")
    for point in suggestion["rationale"]:
        lines.append("- " + point)
    lines.append("")
    lines.append("## 描述统计与相关分析")
    lines.append("```python")
    lines.append(
        "df.describe(include='all')  # 描述统计\n"
        "df[%r].corr()  # 相关矩阵" % suggestion["independents"]
    )
    lines.append("```")
    lines.append("")
    lines.append("## Python 模板（statsmodels）")
    lines.append("```python")
    lines.append(templates["python"])
    lines.append("```")
    lines.append("")
    lines.append("## R 模板（plm / lme4）")
    lines.append("```r")
    lines.append(templates["r"])
    lines.append("```")
    lines.append("")
    lines.append("## 结果解读清单")
    for point in interpretation_template(dependent, independents):
        lines.append("- " + point)
    lines.append("")
    lines.append("> 说明：以上均为建议与模板，显著性、因果识别与稳健性结论需研究者基于真实数据确认；本文件不构成研究结论。")
    return "\n".join(lines)
