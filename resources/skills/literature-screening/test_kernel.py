"""Regression tests for literature-screening/kernel.py (deterministic helpers)."""

import importlib.util
import os
import sys
from pathlib import Path

_KERNEL = Path(__file__).resolve().parent / "kernel.py"
_SPEC = importlib.util.spec_from_file_location("literature_screening_kernel", _KERNEL)
_K = importlib.util.module_from_spec(_SPEC)
sys.modules["literature_screening_kernel"] = _K
_SPEC.loader.exec_module(_K)


def test_type_field_contract():
    assert _K.SCREENING_TYPE_FIELDS == (
        "researchQuestion",
        "theory",
        "dataSource",
        "method",
        "conclusion",
        "screeningStatus",
    )
    assert _K.SCREENING_STATUSES == ("pending", "included", "excluded", "uncertain")


def test_score_weighted_total():
    result = _K.screening_score(
        {"relevance": 5, "citations": 4, "journal": 3, "method": 4, "recency": 2},
        weights=(0.4, 0.2, 0.15, 0.15, 0.1),
    )
    assert result["total"] == 4.0  # 2.0 + 0.8 + 0.45 + 0.6 + 0.2
    assert result["weighted"]["relevance"] == 2.0
    assert result["inputs"]["journal"] == 3.0


def test_score_recency_derived_from_year():
    result = _K.screening_score(
        {"relevance": 5, "citations": 4, "journal": 3, "method": 4},
        current_year=2026,
        year=2021,
        citation_half_life=5,
    )
    # age=5 -> recency = 5 * 0.5 ** 1 = 2.5
    assert result["inputs"]["recency"] == 2.5
    assert result["total"] == round(2.0 + 0.8 + 0.45 + 0.6 + 0.25, 1)


def test_score_citations_normalized():
    result = _K.screening_score(
        {"relevance": 4, "journal": 3, "method": 4, "recency": 3},
        citations=80,
        max_citations=200,
    )
    assert result["inputs"]["citations"] == 2.0  # 5 * 80 / 200


def test_score_clamps_to_5():
    result = _K.screening_score(
        {"relevance": 7, "citations": 9, "journal": 5, "method": 5, "recency": 5}
    )
    assert result["total"] == 5.0
    assert result["inputs"]["relevance"] == 5.0


def test_score_rejects_bad_weight_count():
    try:
        _K.screening_score({"relevance": 1}, weights=(0.5, 0.5))
    except ValueError:
        return
    raise AssertionError("expected ValueError for 2 weights")


def test_validate_analysis():
    ok = _K.screening_validate_analysis(
        {
            "researchQuestion": "Does AI affect firm innovation?",
            "method": "panel FE",
            "conclusion": "Positive effect.",
            "screeningStatus": "included",
        }
    )
    assert ok["ok"] is True and ok["missing"] == []

    partial = _K.screening_validate_analysis({"researchQuestion": ""})
    assert "researchQuestion" in partial["missing"]

    bad_status = _K.screening_validate_analysis({"screeningStatus": "maybe"})
    assert bad_status["ok"] is False and len(bad_status["problems"]) == 1


def test_status_label():
    assert _K.screening_status_label("included") == "included"
    assert _K.screening_status_label("nonsense") == "pending"


def test_markdown_table_sorted_by_relevance():
    rows = [
        {
            "paper": "[Smith 2021](https://doi.org/10.1/abc)",
            "year": 2021,
            "journal": "SMJ",
            "method": "DID",
            "conclusion": "Positive.",
            "relevance": 4.0,
        },
        {
            "paper": "[Jones 2022](https://doi.org/10.1/def)",
            "year": 2022,
            "journal": "AMJ",
            "method": "Case",
            "conclusion": "Mixed.",
            "relevance": 2.0,
        },
        {"paper": "[NoScore 2020](https://doi.org/10.1/ghi)", "year": 2020, "relevance": None},
    ]
    table = _K.screening_markdown_table(rows)
    lines = table.splitlines()
    assert lines[0].startswith("| Paper | Year | Journal | Method | Conclusion | Relevance |")
    assert "Smith 2021" in lines[2] and "4.0" in lines[2]
    assert "Jones 2022" in lines[3]
    assert "NoScore 2020" in lines[4]
    assert "2021" in lines[2]


if __name__ == "__main__":
    import traceback

    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
            except Exception:
                failures += 1
                print(f"FAIL {name}")
                traceback.print_exc()
    if failures:
        print(f"{failures} test(s) failed")
        sys.exit(1)
    print("all literature-screening kernel tests passed")
