---
name: literature-screening
description: Run a systematic literature screening workflow for economics and management research — expand a research topic into a keyword family, configure sources, analyze imported records into structured fields (research question, theory, data, method, conclusion), score each paper by relevance, citations, journal rank, method and recency, and produce a screening table. Complements the literature-review skill. Screening builds the shortlist, and literature-review synthesizes it.
license: Apache-2.0
metadata:
  # Non-biomodel: reuses the Crossref/OpenAlex retrieval helpers from the
  # literature-review kernel (OpenAlex requires the user's api_key since
  # 2026-02-13). No new third-party service is introduced.
  third_party:
    - kind: service
      name: Crossref
      info_url: https://www.crossref.org/documentation/retrieve-metadata/
      privacy_url: https://www.crossref.org/operations-and-sustainability/privacy/
    - kind: service
      name: OpenAlex
      terms_url: https://openalex.org/OpenAlex_termsofservice.pdf
      privacy_url: https://openalex.org/OpenAlex_privacy_policy.pdf
---

# Literature screening

A screening workflow turns a research topic into a defensible shortlist: keyword expansion, source configuration, import, structured analysis, and scoring. The deliverable is a screening table — paper, year, journal, method, conclusion, relevance — with every row traceable to a real record. It is a research-assistance tool, not an automatic paper generator: the researcher owns the final inclusion decisions.

## Setup (any agent, no API key)

This is a **pure skill** — `kernel.py` is deterministic Python, and _you_ (the base model) do the reasoning. Load the literature-review kernel first (its search/verify helpers are reused), then this skill's kernel, once per session in a Python cell:

```python
exec(open("<literature-review skill dir>/kernel.py").read())
exec(open("<this skill's directory>/kernel.py").read())
```

Configuration is via environment variables, not a host:

- `OPENALEX_API_KEY` — required for the OpenAlex-backed steps (`search_openalex`, `expand_citations`); free at https://openalex.org/settings/api.
- `HOST_USER_EMAIL` — optional contact email for the CrossRef/doi.org polite pool (never sent to OpenAlex).

If a helper name is not defined, you have not exec'd one of the kernels.

## The five steps

### Step 1 — Keyword expansion

From the researcher's topic (e.g. "AI and firm innovation"), produce a keyword family with both languages and concept layers, and save it as an artifact:

- Core terms and synonyms (e.g. artificial intelligence, AI, machine learning, generative AI).
- Related constructs on each side of the causal chain (technology adoption, digital transformation → innovation, R&D, firm performance).
- Chinese and English variants (e.g. 人工智能, 企业创新, 数字化转型).
- Database-specific syntax notes (OpenAlex search tokens, arXiv categories if used).

A keyword family of 8–20 entries is normal for one research question. Keep the mapping between keywords and the research question explicit.

### Step 2 — Source configuration

Confirm with the researcher which sources to use and what the app supports:

- Crossref (metadata, DOIs), OpenAlex (metadata + citations + abstracts), arXiv (working papers), and the app's full-text finders (Unpaywall/PMC/arXiv via the app's full-text lookup).
- Google Scholar has no open API; recommend Semantic Scholar only when the app has a custom connector for it.
- Record the chosen sources and any limits (years, item types, language) in the screening notes.

### Step 3 — Import

Records enter the app's literature library through its import dialogs (PDF batch import; DOI/PMID/arXiv/BibTeX/RIS/CSV record import). The screening workflow does not replace import:

- Prefer records with identifiers (DOI/arXiv ID) so metadata and citation counts can be verified.
- For each imported item, verify the DOI with `verify_dois` when one is present; flag retracted or unresolvable DOIs instead of silently dropping them.

### Step 4 — Structured analysis

For each imported record, extract into the app's per-item structured fields (`typeFields` on the literature item). Use exactly these keys so the app's screening table can render them:

| Key | Meaning |
| --- | --- |
| `researchQuestion` | the question(s) the paper answers |
| `theory` | theoretical basis / framework (e.g. RBV, agency theory, TAM) |
| `dataSource` | data source and sample (e.g. CSMAR 2010–2020, 3,000 firms) |
| `method` | method(s) (e.g. OLS + IV, DID, panel FE, case study) |
| `conclusion` | core finding in one or two sentences |
| `screeningStatus` | one of `pending` / `included` / `excluded` / `uncertain` |

Rules:

- Extract from the retrieved record and the available full text — never invent `researchQuestion`, `dataSource` or `conclusion`. If the record has no abstract and no full text, write the fields you can ground and mark the rest `—` (not a guess).
- Keep `conclusion` a claim the paper actually makes; distinguish the authors' finding from your own assessment (put your assessment in `personalNote`).
- `screeningStatus` is your recommendation, not the researcher's final decision; the researcher overrides it in the app.

### Step 5 — Scoring and the screening table

Score each included-or-uncertain record 0–5 into the app's `rating` field, using `screening_score` from `kernel.py` as the arithmetic helper. The five criteria and their weights (configurable by the researcher):

| Criterion | Default weight | Basis |
| --- | --- | --- |
| Relevance to the research question | 40% | your judgment against the keyword family |
| Citation count | 20% | OpenAlex cited_by_count (recency-normalized) |
| Journal rank | 15% | ABS/AJG, CCF, or field-known outlets; top-5/field-top |
| Method quality | 15% | identification strategy, data, robustness |
| Recency | 10% | half-life decay from current year |

`screening_score` returns the weighted total and the per-criterion breakdown; you supply the criterion values (0–5 each) with a one-line justification per criterion. **The score is a recommendation** — the researcher can override it in the app.

Output the screening table as a Markdown artifact (and show it in the reply):

| Paper | Year | Journal | Method | Conclusion | Relevance |
| --- | --- | --- | --- | --- | --- |

Use `screening_markdown_table` to render it from your working rows. Link each paper to its DOI as `[Author Year](https://doi.org/...)`; the author/year come from the retrieved record, never from recall. Keep rows sortable by score and keep excluded records in a second section with a one-line reason each.

## Grounding and honesty

- A DOI you emit either resolves to a real paper that says what you claim, or it is a fabrication — verify with `verify_dois`.
- Do not pad the shortlist with look-alike papers to reach a count; a screening with honest exclusions is better than a padded one.
- Flag preprints as preprints; note when citation counts are unavailable.
- The screening table is a research aid: the researcher decides inclusion. Never present your scoring as a substitute for the researcher's judgment.

## Style before saving

Run `style_pass(draft)` (from the literature-review kernel) on the final Markdown once, fix what it lists, then save. Do not loop until it returns ok; it is a lint, not a gate.
