# Ignis Atlas — AI Engineering & Review Log (`ai_log.md`)

This log records every AI-assisted development step, algorithmic assumption, provenance check, and human verification performed for the Ignis Atlas logic engine.

---

## Log Entry 1: Coverage Engine Architecture & Formula Verification
- **Date / Timestamp:** 2026-11-13T13:08:00Z
- **Module:** `src/logic/coverage.js`
- **AI Contribution:** Designed weighted distance metric across multi-dimensional microgravity combustion parameter space.
- **Formulas & Assumptions:**
  - $D = \frac{\sum (w_i \cdot \text{gap}_i)}{\sum w_i}$
  - Variable Spans: $\text{Span}(\text{O}_2) = 100$, $\text{Span}(P) = 75\ \text{psi}$, $\text{Span}(\text{Flow}) = 50\ \text{cm/s}$.
  - Weights: $\text{O}_2 = 0.35$, $\text{Pressure} = 0.25$, $\text{Airflow} = 0.15$, $\text{Material} = 0.15$, $\text{Gravity} = 0.10$.
  - Status thresholds: $D \le 0.10 \land \text{MaterialGap} == 0 \implies \text{covered}$; $D \le 0.35 \implies \text{near}$; else $\text{gap}$.
  - "Insufficient" if fewer than 2 numeric variables can be evaluated.
  - Cap Rule: Partial-gravity scenarios (`lunar`, `mars`) are capped at `"near"` because standard PSI databases currently lack standardized 0.16g / 0.38g data.
- **Human Reviewer Sign-Off:** Verified that weights sum to 1.0, spans prevent dimension skew, and cap rule prevents false confidence in unvalidated lunar regimes.

---

## Log Entry 2: Experiment Ranking Engine
- **Date / Timestamp:** 2026-11-13T13:08:40Z
- **Module:** `src/logic/rank.js`
- **AI Contribution:** Implemented multi-tier deterministic sorting: Status Priority (`covered` > `near` > `gap` > `insufficient`) followed by ascending normalized distance, and ID tie-breaking.
- **Human Reviewer Sign-Off:** Confirmed deterministic output with no nondeterministic jitter or heuristic guessing.

---

## Log Entry 3: Next Tests Parameter Grid Exploration
- **Date / Timestamp:** 2026-11-13T13:09:00Z
- **Module:** `src/logic/nextTests.js`
- **AI Contribution:** Grid search over the lunar habitat envelope ($\text{O}_2 \in [30, 50]\%$, step 2; $P \in [4.3, 10.2]\ \text{psi}$, step 0.5) against complete experiment envelopes to find the 3 farthest unmapped cells.
- **Provenance & Grounding:** Strictly limited to logged rows in `experiments.json`. Includes explicit statement: *"Results depend on logged rows in experiments.json only."*
- **Human Reviewer Sign-Off:** Verified grid bounds cover exploration baseline up to suit pressure and extreme enrichment.

---

## Log Entry 4: Grounded Answer & Numerical Post-Check Architecture
- **Date / Timestamp:** 2026-11-13T13:09:30Z
- **Module:** `src/logic/groundedAnswer.js`
- **AI Contribution:** Designed strict grounding framework:
  - Output contract: `{ steps: string[], claims: Array<{ text: string, source_ids: string[] }>, refused: boolean, related_experiments?: Array<Object> }`.
  - Every claim links directly to experiment `source_ids` for inline UI source chips.
  - Post-check in code regex-extracts all numbers from draft claims and validates their presence in referenced experiment rows.
  - If any number is ungrounded, refuses the answer with `"No data in the table for this question"` and supplies related experiments.
  - Zero confidence percentages emitted.
- **Human Reviewer Sign-Off:** Verified that the numerical post-check eliminates hallucinated bounds or test results.

---

## Log Entry 5: 5-Scenario Test Suite Execution
- **Date / Timestamp:** 2026-11-13T13:10:00Z
- **Module:** `tests.js`
- **AI Contribution:** Created 5 comprehensive scenarios with hand-computed distances and statuses.
- **Scenarios Evaluated:**
  1. Exact match $\to$ `covered`
  2. Right conditions but wrong fuel/material $\to$ `near`
  3. Far conditions + unknown material $\to$ `gap`
  4. Lunar gravity match $\to$ capped at `near`
  5. Missing numeric variables ($<2$ comparable) $\to$ `insufficient`
- **Human Reviewer Sign-Off:** Confirmed all 5 test assertions pass cleanly with `node tests.js`.

