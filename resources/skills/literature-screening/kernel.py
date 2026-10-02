"""
Literature-screening helpers — pure-skill, provider-agnostic.

    SCREENING_TYPE_FIELDS, screening_score, screening_markdown_table,
    screening_validate_analysis, screening_status_label

There is no ``host`` runtime here: these are deterministic Python helpers.
Load once per session by exec-ing this file in a Python cell (the
literature-review kernel must be loaded first so its search/verify helpers
are available):

    exec(open("<literature-review skill dir>/kernel.py").read())
    exec(open("<this skill's directory>/kernel.py").read())

The screening workflow itself (keyword expansion, analysis, scoring judgment)
is the base model's job; these helpers only keep the arithmetic and the
output format deterministic.
"""

from __future__ import annotations

import datetime as _dt

# Structured-analysis keys written into the app's per-item typeFields, shared
# with the renderer's screening columns. Do not rename without updating
# src/shared/literature.ts LITERATURE_SCREENING_TYPE_FIELDS.
SCREENING_TYPE_FIELDS = (
    "researchQuestion",
    "theory",
    "dataSource",
    "method",
    "conclusion",
    "screeningStatus",
)

SCREENING_STATUSES = ("pending", "included", "excluded", "uncertain")

# Default scoring weights: relevance / citations / journal / method / recency.
SCREENING_DEFAULT_WEIGHTS = (0.40, 0.20, 0.15, 0.15, 0.10)


def screening_score(
    criterion_values,
    weights=None,
    current_year=None,
    year=None,
    citation_half_life=5,
    citations=None,
    max_citations=None,
):
    """Weighted 0-5 screening score with a per-criterion breakdown.

    ``criterion_values`` is a dict of 0-5 floats keyed by
    'relevance' | 'citations' | 'journal' | 'method' | 'recency'.
    When ``year`` and ``current_year`` are given and 'recency' is absent, it
    is computed as ``max(0, 5 * 0.5 ** ((current_year - year) / half_life))``.
    When 'citations' is absent but ``citations`` and ``max_citations`` are
    given, it is normalized as ``5 * citations / max_citations`` (clamped to
    5). Returns ``{'total': float, 'weighted': {...}, 'inputs': {...}}`` where
    ``total`` is rounded to one decimal and ``weighted`` holds each
    criterion's weighted contribution (0-5 scale preserved per criterion).
    """
    weights = tuple(weights) if weights is not None else SCREENING_DEFAULT_WEIGHTS
    if len(weights) != 5:
        raise ValueError("screening_score expects exactly 5 weights")
    current_year = current_year or _dt.date.today().year

    def _clip(v):
        return max(0.0, min(5.0, float(v)))

    values = dict(criterion_values)
    if "recency" not in values and year is not None:
        age = max(0, int(current_year) - int(year))
        values["recency"] = 5.0 * (0.5 ** (age / float(citation_half_life)))
    if (
        "citations" not in values
        and citations is not None
        and max_citations is not None
        and max_citations > 0
    ):
        values["citations"] = min(5.0, 5.0 * float(citations) / float(max_citations))
    keys = ("relevance", "citations", "journal", "method", "recency")
    weighted = {}
    total = 0.0
    for key, weight in zip(keys, weights):
        value = _clip(values.get(key, 0.0))
        weighted[key] = round(value * weight, 2)
        total += value * weight
    return {
        "total": round(min(5.0, total), 1),
        "weighted": weighted,
        "inputs": {key: round(_clip(values.get(key, 0.0)), 2) for key in keys},
    }


def screening_validate_analysis(record):
    """Validate a structured-analysis record before it is written.

    ``record`` is a dict with any of the SCREENING_TYPE_FIELDS keys.
    Returns ``{'ok': bool, 'missing': list[str], 'problems': list[str]}``.
    ``researchQuestion``, ``method`` and ``conclusion`` are required non-empty;
    ``screeningStatus`` must be one of the allowed statuses when present.
    This is a lint, not a gate: a record missing a field because no full text
    exists is acceptable and is reported as ``missing``, not rejected.
    """
    missing = []
    problems = []
    for key in ("researchQuestion", "method", "conclusion"):
        value = record.get(key)
        if value is None or str(value).strip() in ("", "-", "—"):
            missing.append(key)
    status = record.get("screeningStatus")
    if status is not None and status not in SCREENING_STATUSES:
        problems.append(f"screeningStatus must be one of {list(SCREENING_STATUSES)}")
    return {"ok": not problems, "missing": missing, "problems": problems}


def screening_status_label(status):
    """Canonical short label for a screening status (renderer-friendly)."""
    return status if status in SCREENING_STATUSES else "pending"


def screening_markdown_table(rows):
    """Render a screening table as Markdown.

    ``rows`` is a list of dicts with keys
    'paper' (markdown link text), 'year', 'journal', 'method',
    'conclusion', 'relevance' (0-5 number or '-'). Returns the Markdown
    table string, sorted by relevance descending (unknown last), with a
    header row of Paper | Year | Journal | Method | Conclusion | Relevance.
    """
    header = ["Paper", "Year", "Journal", "Method", "Conclusion", "Relevance"]
    ordered = sorted(
        rows,
        key=lambda row: (
            row.get("relevance") is None,
            -float(row.get("relevance") or 0),
        ),
    )
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]

    def _cell(value):
        text = "-" if value is None or str(value).strip() == "" else str(value).strip()
        return text.replace("|", "\\|").replace("\n", " ")

    for row in ordered:
        relevance = row.get("relevance")
        relevance_cell = (
            "-"
            if relevance is None
            else (f"{float(relevance):.1f}" if isinstance(relevance, (int, float)) else str(relevance))
        )
        lines.append(
            "| "
            + " | ".join(
                _cell(row.get(key))
                for key in ("paper", "year", "journal", "method", "conclusion")
            )
            + f" | {relevance_cell} |"
        )
    return "\n".join(lines)
