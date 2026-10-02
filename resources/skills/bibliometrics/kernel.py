"""Bibliometric analysis kernel for the `bibliometrics` skill.

Pure Python standard library only (no sklearn/networkx), so the kernel runs
anywhere Python 3.9+ is available. All functions are deterministic and
side-effect free; the frontend panel reuses the same algorithms in TypeScript
via `src/shared/bibliometrics.ts`.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

ENGLISH_STOPWORDS = {
    "the", "a", "an", "of", "in", "on", "for", "and", "or", "to", "with",
    "from", "by", "at", "as", "is", "are", "was", "were", "be", "been",
    "this", "that", "these", "those", "study", "studies", "analysis",
    "evidence", "role", "effect", "effects", "impact", "new", "toward",
    "towards", "review", "research", "using", "use", "based", "between",
    "among", "under", "over", "into", "its", "their", "our", "we", "can",
    "may", "will",
}

_EDGE_SEPARATOR = "\u0000"


def keywords_from_title(title: str, limit: int = 8) -> List[str]:
    """Extracts a conservative keyword list from a free-text title.

    English words are lower-cased and stop-word filtered; CJK chunks (no
    spaces) are kept whole so Chinese titles still contribute keywords.
    """
    seen: set[str] = set()
    result: List[str] = []

    def push(token: str) -> None:
        token = token.strip().lower()
        if len(token) < 2 or token in seen:
            return
        seen.add(token)
        result.append(token)

    for chunk in re.split(r"[\s,;:()\[\]]+", title):
        if not chunk:
            continue
        if re.search(r"[\u4e00-\u9fff]", chunk):
            push(chunk)
            continue
        for word in re.split(r"\s+", chunk.lower()):
            if word and word not in ENGLISH_STOPWORDS:
                push(word)
    return result[:limit]


def parse_keywords(value: Any) -> List[str]:
    """Accepts a list of strings or a single delimiter-separated string."""
    if isinstance(value, (list, tuple)):
        out = []
        for entry in value:
            if isinstance(entry, str) and entry.strip():
                out.append(entry.strip())
        return out
    if isinstance(value, str) and value.strip():
        return [part.strip() for part in re.split(r"[;|,]", value) if part.strip()]
    return []


def normalize_documents(documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalizes a document list into {title, year, keywords} records."""
    normalized = []
    for doc in documents:
        if not isinstance(doc, dict):
            continue
        raw_title = doc.get("title")
        if not isinstance(raw_title, str) or not raw_title.strip():
            continue
        title = raw_title
        year_raw = doc.get("year")
        try:
            year = int(year_raw) if year_raw not in (None, "", "null") else None
        except (TypeError, ValueError):
            year = None
        explicit = parse_keywords(doc.get("keywords"))
        keywords = explicit if explicit else keywords_from_title(title)
        normalized.append({"title": title, "year": year, "keywords": keywords})
    return normalized


def keyword_frequencies(documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Distinct keywords with document counts, sorted by count desc then name."""
    counter: Counter = Counter()
    for doc in documents:
        for keyword in set(doc["keywords"]):
            counter[keyword] += 1
    return sorted(
        [{"keyword": keyword, "count": count} for keyword, count in counter.items()],
        key=lambda entry: (-entry["count"], entry["keyword"]),
    )


def cooccurrence_matrix(
    documents: List[Dict[str, Any]], max_edges: int = 60
) -> List[Dict[str, Any]]:
    """Pairwise keyword co-occurrence edges, sorted by weight desc."""
    counts: Counter = Counter()
    for doc in documents:
        unique = list(dict.fromkeys(doc["keywords"]))
        for i in range(len(unique)):
            for j in range(i + 1, len(unique)):
                a, b = unique[i], unique[j]
                key = a + _EDGE_SEPARATOR + b if a < b else b + _EDGE_SEPARATOR + a
                counts[key] += 1
    edges = []
    for key, weight in counts.items():
        source, target = key.split(_EDGE_SEPARATOR)
        edges.append({"source": source, "target": target, "weight": weight})
    return sorted(edges, key=lambda edge: (-edge["weight"], edge["source"]))[:max_edges]


def cluster_keywords(
    documents: List[Dict[str, Any]], max_edges: int = 60
) -> List[Dict[str, Any]]:
    """Connected components of the co-occurrence graph => topic clusters."""
    frequencies = keyword_frequencies(documents)
    freq = {entry["keyword"]: entry["count"] for entry in frequencies}
    adjacency: Dict[str, set] = {}
    for edge in cooccurrence_matrix(documents, max_edges):
        adjacency.setdefault(edge["source"], set()).add(edge["target"])
        adjacency.setdefault(edge["target"], set()).add(edge["source"])
    visited: set[str] = set()
    clusters = []
    for entry in frequencies:
        keyword = entry["keyword"]
        if keyword in visited:
            continue
        component = []
        queue = [keyword]
        visited.add(keyword)
        while queue:
            current = queue.pop(0)
            component.append(current)
            for neighbor in adjacency.get(current, set()):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        if not component:
            continue
        member_set = set(component)
        document_count = sum(
            1 for doc in documents if any(k in member_set for k in doc["keywords"])
        )
        ordered = sorted(component, key=lambda k: (-freq.get(k, 0), k))
        clusters.append(
            {
                "id": "cluster-%d" % (len(clusters) + 1),
                "label": ordered[0],
                "keywords": ordered,
                "documentCount": document_count,
            }
        )
    return sorted(clusters, key=lambda c: (-c["documentCount"], c["label"]))


def hotspots(
    documents: List[Dict[str, Any]], window: int = 3, limit: int = 10
) -> List[Dict[str, Any]]:
    """Keyword frequency plus recent growth (last `window` years vs. prior)."""
    frequencies = keyword_frequencies(documents)
    years = [doc["year"] for doc in documents if doc["year"] is not None]
    latest = max(years) if years else None
    if latest is None:
        return [
            {"keyword": entry["keyword"], "totalCount": entry["count"], "recentCount": 0, "growth": None}
            for entry in frequencies[:limit]
        ]
    recent_floor = latest - window
    results = []
    for entry in frequencies:
        keyword = entry["keyword"]
        recent_count = 0
        prior_count = 0
        for doc in documents:
            if doc["year"] is None:
                continue
            if keyword in doc["keywords"]:
                if doc["year"] > recent_floor:
                    recent_count += 1
                else:
                    prior_count += 1
        if prior_count > 0:
            growth = (recent_count - prior_count) / prior_count
        elif recent_count > 0:
            growth = None
        else:
            growth = 0
        results.append(
            {
                "keyword": keyword,
                "totalCount": entry["count"],
                "recentCount": recent_count,
                "growth": growth,
            }
        )
    return sorted(
        results,
        key=lambda r: (
            r["growth"] is None,
            -(r["growth"] if r["growth"] is not None else 0),
            -r["totalCount"],
        ),
    )[:limit]


def topic_trends(
    documents: List[Dict[str, Any]], top_keywords: int = 6
) -> List[Dict[str, Any]]:
    """Per-year counts for the top keywords, ordered by year ascending."""
    frequencies = keyword_frequencies(documents)
    trend_keywords = [entry["keyword"] for entry in frequencies[:top_keywords]]
    years = sorted({doc["year"] for doc in documents if doc["year"] is not None})
    points = []
    for year in years:
        for keyword in trend_keywords:
            count = sum(1 for doc in documents if doc["year"] == year and keyword in doc["keywords"])
            if count > 0:
                points.append({"year": year, "keyword": keyword, "count": count})
    return points


def analyze(documents: List[Dict[str, Any]], max_edges: int = 60,
            top_keywords: int = 6, limit: int = 10) -> Dict[str, Any]:
    """Full analysis in one call, mirroring the shared TypeScript contract."""
    normalized = normalize_documents(documents)
    dated = [doc["year"] for doc in normalized if doc["year"] is not None]
    return {
        "totalItems": len(normalized),
        "yearRange": [min(dated), max(dated)] if dated else None,
        "keywordNetwork": cooccurrence_matrix(normalized, max_edges),
        "clusters": cluster_keywords(normalized, max_edges),
        "hotspots": hotspots(normalized, limit=limit),
        "trends": topic_trends(normalized, top_keywords),
        "keywordFrequencies": keyword_frequencies(normalized)[:50],
    }


def to_json(analysis: Dict[str, Any]) -> str:
    return json.dumps(analysis, ensure_ascii=False, indent=2)


def bibliometrics_markdown(analysis: Dict[str, Any]) -> str:
    """Renders a reproducible Markdown report of the analysis."""
    lines = ["# 文献计量分析报告", ""]
    if analysis.get("totalItems", 0) == 0:
        lines.append("> 输入文献为空，未生成统计结果。")
        return "\n".join(lines)
    year_range = analysis.get("yearRange")
    lines.append(
        "共分析文献 **%d** 篇%s。"
        % (
            analysis["totalItems"],
            "（年份范围 %d–%d）" % (year_range[0], year_range[1]) if year_range else "",
        )
    )
    lines.append("")
    lines.append("## 关键词频次")
    lines.append("| 关键词 | 文献数 |")
    lines.append("| --- | --- |")
    for entry in analysis["keywordFrequencies"]:
        lines.append("| %s | %d |" % (entry["keyword"], entry["count"]))
    lines.append("")
    lines.append("## 共现网络 Top 边")
    lines.append("| 词 A | 词 B | 共现次数 |")
    lines.append("| --- | --- | --- |")
    for edge in analysis["keywordNetwork"]:
        lines.append("| %s | %s | %d |" % (edge["source"], edge["target"], edge["weight"]))
    lines.append("")
    lines.append("## 关键词聚类")
    lines.append("| 簇 | 代表词 | 关键词 | 文献覆盖 |")
    lines.append("| --- | --- | --- | --- |")
    for cluster in analysis["clusters"]:
        lines.append(
            "| %s | %s | %s | %d |"
            % (cluster["id"], cluster["label"], "、".join(cluster["keywords"]), cluster["documentCount"])
        )
    lines.append("")
    lines.append("## 研究热点（近 3 年增长）")
    lines.append("| 关键词 | 总文献数 | 近 3 年 | 增长率 |")
    lines.append("| --- | --- | --- | --- |")
    for hotspot in analysis["hotspots"]:
        growth = "—" if hotspot["growth"] is None else "%.0f%%" % (hotspot["growth"] * 100)
        lines.append(
            "| %s | %d | %d | %s |" % (hotspot["keyword"], hotspot["totalCount"], hotspot["recentCount"], growth)
        )
    lines.append("")
    lines.append("## 时间演化（Top 关键词逐年出现次数）")
    lines.append("| 年份 | 关键词 | 次数 |")
    lines.append("| --- | --- | --- |")
    for point in analysis["trends"]:
        lines.append("| %d | %s | %d |" % (point["year"], point["keyword"], point["count"]))
    lines.append("")
    lines.append("> 说明：以上均为描述性统计，聚类与热点不代表研究结论；判断由研究者作出。")
    return "\n".join(lines)
