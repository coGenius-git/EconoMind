"""Tests for the bibliometrics kernel (pure standard library, no pytest needed)."""

import json
import sys
import unittest

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from kernel import (  # noqa: E402
    analyze,
    bibliometrics_markdown,
    cluster_keywords,
    cooccurrence_matrix,
    hotspots,
    keyword_frequencies,
    keywords_from_title,
    normalize_documents,
    parse_keywords,
    to_json,
    topic_trends,
)

DOCS = [
    {"title": "AI and firm innovation", "year": 2020,
     "keywords": "artificial intelligence, innovation, firm performance"},
    {"title": "Machine learning in management research", "year": 2021,
     "keywords": "machine learning, innovation, firm performance"},
    {"title": "Digital transformation and firm performance", "year": 2022,
     "keywords": "digital transformation, firm performance"},
    {"title": "AI adoption in Chinese manufacturing", "year": 2023,
     "keywords": "artificial intelligence, manufacturing"},
]


class KeywordsTest(unittest.TestCase):
    def test_keywords_from_title_filters_stopwords(self):
        out = keywords_from_title("The Effect of AI on Firm Innovation")
        self.assertIn("ai", out)
        self.assertIn("firm", out)
        self.assertIn("innovation", out)
        self.assertNotIn("the", out)
        self.assertNotIn("effect", out)

    def test_keywords_from_title_keeps_cjk_chunks(self):
        out = keywords_from_title("人工智能与企业创新研究")
        self.assertTrue(
            any(any("\u4e00" <= ch <= "\u9fff" for ch in token) for token in out)
        )

    def test_parse_keywords_accepts_list_and_string(self):
        self.assertEqual(parse_keywords(["a", "b"]), ["a", "b"])
        self.assertEqual(parse_keywords("a;b|c"), ["a", "b", "c"])


class AnalysisTest(unittest.TestCase):
    def test_normalize_documents_drops_invalid_and_parses_year(self):
        normalized = normalize_documents([DOCS[0], {"title": 123}])
        self.assertEqual(len(normalized), 1)
        self.assertEqual(normalized[0]["year"], 2020)

    def test_keyword_frequencies_sorted(self):
        frequencies = keyword_frequencies(normalize_documents(DOCS))
        self.assertEqual(frequencies[0]["keyword"], "firm performance")
        self.assertEqual(frequencies[0]["count"], 3)

    def test_cooccurrence_matrix_counts_pairs(self):
        edges = cooccurrence_matrix(normalize_documents(DOCS))
        innovation = next(e for e in edges if e["source"] == "innovation")
        self.assertGreaterEqual(innovation["weight"], 1)

    def test_cluster_keywords_connects_components(self):
        clusters = cluster_keywords(normalize_documents(DOCS))
        self.assertGreaterEqual(len(clusters), 1)
        self.assertTrue(all(cluster["documentCount"] > 0 for cluster in clusters))

    def test_hotspots_computes_growth(self):
        result = hotspots(normalize_documents(DOCS), window=3)
        self.assertTrue(all("growth" in entry for entry in result))

    def test_topic_trends_ordered_by_year(self):
        trends = topic_trends(normalize_documents(DOCS))
        years = [point["year"] for point in trends]
        self.assertEqual(years, sorted(years))

    def test_analyze_returns_full_contract(self):
        analysis = analyze(DOCS)
        self.assertEqual(analysis["totalItems"], 4)
        self.assertEqual(analysis["yearRange"], [2020, 2023])
        self.assertTrue(all(k in analysis for k in (
            "keywordNetwork", "clusters", "hotspots", "trends", "keywordFrequencies")))

    def test_analyze_empty_input(self):
        analysis = analyze([])
        self.assertEqual(analysis["totalItems"], 0)
        self.assertIsNone(analysis["yearRange"])
        self.assertEqual(analysis["clusters"], [])

    def test_to_json_round_trip(self):
        analysis = analyze(DOCS)
        self.assertEqual(json.loads(to_json(analysis))["totalItems"], 4)

    def test_bibliometrics_markdown_contains_tables(self):
        markdown = bibliometrics_markdown(analyze(DOCS))
        self.assertIn("## 关键词频次", markdown)
        self.assertIn("| 关键词 | 文献数 |", markdown)
        self.assertIn("说明：以上均为描述性统计", markdown)

    def test_bibliometrics_markdown_empty(self):
        markdown = bibliometrics_markdown(analyze([]))
        self.assertIn("输入文献为空", markdown)


if __name__ == "__main__":
    unittest.main()
