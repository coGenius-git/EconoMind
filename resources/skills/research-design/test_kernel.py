"""Tests for the research-design kernel (pure standard library, no pytest needed)."""

import sys
import unittest

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from kernel import build_design, design_markdown, parse_variables  # noqa: E402


class ParseVariablesTest(unittest.TestCase):
    def test_chinese_construction(self):
        parsed = parse_variables("数字化转型对企业创新的影响")
        self.assertEqual(parsed["x"], "数字化转型")
        self.assertEqual(parsed["y"], "企业创新")

    def test_english_construction(self):
        parsed = parse_variables("The effect of digital transformation on firm innovation")
        self.assertEqual(parsed["x"], "digital transformation")
        self.assertEqual(parsed["y"], "firm innovation")

    def test_unknown_question_yields_none(self):
        parsed = parse_variables("如何提升研究质量")
        self.assertIsNone(parsed["x"])
        self.assertIsNone(parsed["y"])


class BuildDesignTest(unittest.TestCase):
    def test_explicit_variables_win(self):
        design = build_design(
            "研究主题",
            {"x": "数字化转型", "y": "企业创新", "mediator": "知识管理能力"},
        )
        self.assertEqual(design["variables"]["x"], "数字化转型")
        self.assertEqual(design["variables"]["y"], "企业创新")
        self.assertEqual(len(design["hypotheses"]), 2)

    def test_question_guessing_fills_variables(self):
        design = build_design("人工智能对企业创新影响研究")
        self.assertEqual(design["variables"]["x"], "人工智能")
        self.assertEqual(design["variables"]["y"], "企业创新")

    def test_missing_fields_are_placeholders(self):
        design = build_design("一个尚不明确的研究问题")
        self.assertIsNone(design["variables"]["x"])
        self.assertIsNone(design["theory"])
        self.assertEqual(design["hypotheses"], [])
        self.assertIn("待研究者补充变量", design["model"])

    def test_empty_question_raises(self):
        with self.assertRaises(ValueError):
            build_design("")

    def test_moderator_hypothesis(self):
        design = build_design(
            "主题", {"x": "A", "y": "B", "moderator": "W"}
        )
        self.assertEqual(len(design["hypotheses"]), 2)
        self.assertIn("调节", design["hypotheses"][1])

    def test_model_contains_controls_when_supplied(self):
        design = build_design("主题", {"x": "A", "y": "B", "controls": "规模, 年龄"})
        self.assertIn("γ·Controls", design["model"])


class MarkdownTest(unittest.TestCase):
    def test_markdown_contains_sections(self):
        design = build_design(
            "数字化转型对企业创新的影响",
            {"x": "数字化转型", "y": "企业创新", "theory": "资源基础观"},
        )
        markdown = design_markdown(design)
        self.assertIn("# 研究设计", markdown)
        self.assertIn("## 理论基础", markdown)
        self.assertIn("## 变量设计", markdown)
        self.assertIn("## 假设", markdown)
        self.assertIn("## 计量模型", markdown)
        self.assertIn("资源基础观", markdown)

    def test_markdown_marks_placeholders(self):
        markdown = design_markdown(build_design("一个尚不明确的研究问题"))
        self.assertIn("待研究者补充理论视角", markdown)
        self.assertIn("待研究者补充假设", markdown)
        self.assertIn("不构成论文正文", markdown)


if __name__ == "__main__":
    unittest.main()
