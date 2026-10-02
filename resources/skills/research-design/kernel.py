"""Research design kernel for the `research-design` skill.

Pure Python standard library. The kernel structures a research question into
a reviewable design framework (theory / variables / hypotheses / model). It
never fabricates variables or theories: anything not present in the input
becomes an explicit placeholder marked as "to be confirmed by the researcher".
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# Relationship patterns used to propose a first hypothesis draft. The draft is
# always marked as such; the researcher owns the final wording.
_RELATION_PATTERNS = [
    (re.compile(r"(.+?)(?:与|和|对|and|between|of).{0,6}(?:的)?(?:影响|关系|作用)(?:研究|分析|机制)?", re.I),
     "{x} 对 {y} 有显著影响（草案，待研究者确认方向与显著性）"),
]


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _first(pattern: re.Pattern[str], text: str) -> Optional[str]:
    match = pattern.search(text)
    return clean(match.group(1)) if match else None


def parse_variables(question: str) -> Dict[str, Optional[str]]:
    """Rule-based variable extraction. Returns only best-effort guesses."""
    question = clean(question)
    x = y = None
    # Common Chinese constructions: "X 对 Y 的影响" / "X 与 Y 的关系"
    match = re.search(r"(.+?)\s*(?:对|与|和|on|and)\s*(.+?)\s*(?:的)?(?:影响|关系|作用|机制)", question)
    if match:
        left, right = clean(match.group(1)), clean(match.group(2))
        left = re.sub(r"^(?:研究|分析|探讨|考察|检验)\s*", "", left)
        right = re.sub(r"\s*(?:研究|分析|探讨|考察|检验)$", "", right)
        if left and right and len(left) <= 24 and len(right) <= 24:
            x, y = left, right
    # English constructions: "the effect of X on Y" / "how X affects Y"
    if x is None or y is None:
        match = re.search(r"(?:the\s+)?(?:effect|impact|influence|role)\s+of\s+(.+?)\s+on\s+(.+)", question, re.I)
        if match:
            x, y = clean(match.group(1)), clean(match.group(2))
    return {"x": x, "y": y}


def build_design(question: str, explicit: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Builds a structured research design from a question and explicit inputs."""
    explicit = explicit or {}
    question = clean(question)
    if not question:
        raise ValueError("research question is required")

    variables = {
        "x": clean(str(explicit.get("x") or "")) or None,
        "y": clean(str(explicit.get("y") or "")) or None,
        "mediator": clean(str(explicit.get("mediator") or "")) or None,
        "moderator": clean(str(explicit.get("moderator") or "")) or None,
        "controls": clean(str(explicit.get("controls") or "")) or None,
    }
    if variables["x"] is None or variables["y"] is None:
        guessed = parse_variables(question)
        variables["x"] = variables["x"] or guessed["x"]
        variables["y"] = variables["y"] or guessed["y"]

    hypotheses: List[str] = []
    if variables["x"] and variables["y"]:
        hypotheses.append(f"{variables['x']} 对 {variables['y']} 有显著影响（草案）")
    if variables["x"] and variables["y"] and variables["mediator"]:
        hypotheses.append(
            f"{variables['mediator']} 在 {variables['x']} 与 {variables['y']} 之间起中介作用（草案）"
        )
    if variables["x"] and variables["y"] and variables["moderator"]:
        hypotheses.append(
            f"{variables['moderator']} 调节 {variables['x']} 对 {variables['y']} 的影响（草案）"
        )

    model_lines: List[str] = []
    if variables["x"] and variables["y"]:
        y_sym = "Y"
        x_sym = "X"
        model_lines.append(
            f"{y_sym} = β₀ + β₁·{x_sym}"
            + (" + β₂·M" if variables["mediator"] else "")
            + (" + β₃·X×W + β₄·W" if variables["moderator"] else "")
            + (" + γ·Controls" if variables["controls"] else "")
            + " + ε"
        )
        model_lines.append("注：β/γ 为待估系数，ε 为误差项；具体估计方法（OLS / 固定效应 / IV / DID 等）由研究者确定。")
    else:
        model_lines.append("模型待研究者补充变量后生成。")

    return {
        "researchQuestion": question,
        "theory": clean(str(explicit.get("theory") or "")) or None,
        "variables": variables,
        "hypotheses": hypotheses,
        "model": "\n".join(model_lines),
        "data": clean(str(explicit.get("data") or "")) or None,
        "method": clean(str(explicit.get("method") or "")) or None,
    }


def design_markdown(design: Dict[str, Any]) -> str:
    """Renders a research_design.md draft from the structured design."""
    lines = ["# 研究设计", ""]
    lines.append("## 研究问题")
    lines.append(design["researchQuestion"])
    lines.append("")
    lines.append("## 理论基础")
    if design["theory"]:
        lines.append(design["theory"])
    else:
        lines.append("> 待研究者补充理论视角（如资源基础观、交易成本理论、制度理论等）。")
    lines.append("")
    lines.append("## 变量设计")
    rows = [
        ("自变量 X", design["variables"]["x"]),
        ("因变量 Y", design["variables"]["y"]),
        ("中介变量 M", design["variables"]["mediator"]),
        ("调节变量 W", design["variables"]["moderator"]),
        ("控制变量", design["variables"]["controls"]),
    ]
    lines.append("| 角色 | 变量 |")
    lines.append("| --- | --- |")
    for role, value in rows:
        lines.append("| %s | %s |" % (role, value or "待补充"))
    lines.append("")
    lines.append("## 假设")
    if design["hypotheses"]:
        for index, hypothesis in enumerate(design["hypotheses"], start=1):
            lines.append(f"H{index}：{hypothesis}")
    else:
        lines.append("> 待研究者补充假设。")
    lines.append("")
    lines.append("## 计量模型")
    lines.append("```text")
    lines.append(design["model"])
    lines.append("```")
    if design["method"]:
        lines.append("")
        lines.append("**计划方法**：" + design["method"])
    lines.append("")
    lines.append("## 数据")
    if design["data"]:
        lines.append(design["data"])
    else:
        lines.append("> 待研究者补充数据来源与样本（如 CSMAR / Wind / 上市公司年报手工整理等）。")
    lines.append("")
    lines.append("> 说明：以上假设为草案、模型为模板，均需研究者确认后再进入数据与分析阶段；本文件不构成论文正文。")
    return "\n".join(lines)
