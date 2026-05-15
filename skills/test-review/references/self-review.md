# Self-review

Two passes — both **delegated to parallel Sonnet subagents**, not run inline.

## Pass 1 — Alignment

- **Chained mode:** every impl plan step's tests are reviewed; every spec AC has a coverage map row; no impl-plan step is silently dropped; security spec items have security tests; performance spec items have perf tests.
- **Audit mode:** every public function/route in the target's surface has a row; no source file is skipped.

## Pass 2 — Internal consistency

- Every test in the inventory appears in the coverage map (no orphan tests).
- Every coverage map row references a test that exists in the inventory (no phantom references).
- Every mock listed in the mock-policy audit is justified, or the row is marked ✗ with a rewrite recommendation.
- No DB mock is marked ✓ in the policy audit (project invariant).
- Every determinism risk has a fix in the review.
- Every gap in the coverage map appears in **Gaps & risks** or **Recommendations**.
- Test names describe behavior, not implementation (e.g. "rejects unowned post", not "calls hasAccess()").

## Why delegate

Fresh eyes (the subagent didn't write the review), parallel passes halve wall-clock, Sonnet 4.6 handles the structured walkthrough — main agent (Opus) stays on synthesis.

## How

Spawn ONE subagent per pass in a **single message** (parallel). Each returns a ✓/⚠/✗ table. Collect, fix any ⚠/✗ items, re-spawn *only* the affected pass on changed sections.

`subagent_type: general-purpose`, `model: sonnet`, `description`: 3–5 words ("Test-review alignment" / "Test-review consistency").

Per-subagent brief — verbatim in the `prompt`:

```
You are reviewing a draft test-review document. Read-only — do not edit any files.

INPUTS:
- Source spec (MD): <cwd>/docs/specs/<slug>.md   (chained mode)
- Source impl plan (MD): <cwd>/docs/impl-plans/<slug>.md   (chained mode)
- Target module/dir: <path>   (audit mode)
- Draft test-review (MD): <cwd>/docs/test-reviews/<slug>.md  (or in-flight draft)
- Checklist (this pass only): below

CHECKLIST — <Pass 1: Alignment | Pass 2: Internal consistency>:
<paste the relevant bullets from above>

OUTPUT:
A markdown table: # | Check | Status (✓/⚠/✗) | Note.
For each ⚠ or ✗, the note must be specific — name the test, the AC, the function, or the mock that triggered the flag.

Limit your report to 400 words.
```

Surface both reports inline.

## Don'ts

- Don't run inline yourself.
- Don't spawn with `model: opus`.
- Don't let the subagent edit files.
