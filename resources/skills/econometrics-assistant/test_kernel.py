"""Tests for the econometrics-assistant kernel (pure standard library)."""

import sys
import unittest

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from kernel import (  # noqa: E402
    code_templates,
    econometrics_markdown,
    interpretation_template,
    suggest_model,
)


class SuggestModelTest(unittest.TestCase):
    def test_cross_section_defaults_to_ols(self):
        suggestion = suggest_model("ROA", ["digital_transformation"])
        self.assertIn("普通最小二乘（OLS）", suggestion["candidates"])
        self.assertEqual(suggestion["dependent"], "ROA")

    def test_panel_suggests_fe_and_re(self):
        suggestion = suggest_model("创新绩效", ["数字化转型"], panel=True)
        self.assertTrue(any("固定效应" in candidate for candidate in suggestion["candidates"]))
        self.assertTrue(any("随机效应" in candidate for candidate in suggestion["candidates"]))

    def test_explicit_did(self):
        suggestion = suggest_model("y", ["treatment"], panel=True, method="DID")
        self.assertTrue(any("DID" in candidate for candidate in suggestion["candidates"]))

    def test_explicit_iv(self):
        suggestion = suggest_model("y", ["x"], method="IV")
        self.assertTrue(any("IV" in candidate for candidate in suggestion["candidates"]))

    def test_unknown_method_falls_back(self):
        suggestion = suggest_model("y", ["x"], method="SOMETHING_UNKNOWN")
        self.assertTrue(suggestion["candidates"])

    def test_columns_are_sanitized(self):
        suggestion = suggest_model("ROA (t+1)", ["digital transformation"])
        self.assertEqual(suggestion["dependent"], "ROA_t_1")
        self.assertEqual(suggestion["independents"], ["digital_transformation"])


class CodeTemplateTest(unittest.TestCase):
    def test_python_template_contains_formula(self):
        templates = code_templates("ROA", ["digital_transformation", "size"])
        self.assertIn("ROA ~ digital_transformation + size", templates["python"])
        self.assertIn("statsmodels", templates["python"])

    def test_panel_python_uses_panelols(self):
        templates = code_templates("ROA", ["x1"], panel=True, unit="firm", time="year")
        self.assertIn("PanelOLS", templates["python"])
        self.assertIn("firm", templates["python"])

    def test_r_template_contains_plm(self):
        templates = code_templates("ROA", ["x1"], panel=True, unit="firm", time="year")
        self.assertIn("plm(", templates["r"])
        self.assertIn("lmer(", templates["r"])

    def test_templates_are_strings(self):
        templates = code_templates("y", ["x"])
        self.assertIsInstance(templates["python"], str)
        self.assertIsInstance(templates["r"], str)


class InterpretationTest(unittest.TestCase):
    def test_checklist_has_seven_points(self):
        checklist = interpretation_template("y", ["x"])
        self.assertEqual(len(checklist), 7)
        self.assertTrue(all(point.startswith(("1", "2", "3", "4", "5", "6", "7")) for point in checklist))


class MarkdownTest(unittest.TestCase):
    def test_markdown_contains_all_sections(self):
        markdown = econometrics_markdown("ROA", ["digital_transformation"], panel=True)
        for section in ("# 计量分析建议", "## 模型建议", "## 描述统计与相关分析",
                        "## Python 模板", "## R 模板", "## 结果解读清单"):
            self.assertIn(section, markdown)
        self.assertIn("不构成研究结论", markdown)


if __name__ == "__main__":
    unittest.main()
