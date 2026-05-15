# Self-review

Two passes — both **delegated to parallel Sonnet subagents**, not run inline.

Pass detail lives in [self-review-checklist.md](self-review-checklist.md):

1. **Alignment** — every spec section is reflected in some step; no scope creep.
2. **Internal consistency** — DAG acyclic, no orphan files, every migration has rollback, ACs covered by step tests, step ordering respects dependencies.

## Why delegate

Fresh eyes (the subagent didn't write the plan), parallel passes halve wall-clock, Sonnet 4.6 handles the structured walkthrough — main agent (Opus) stays on synthesis.

## How

Spawn ONE subagent per pass in a **single message** (parallel). Each returns a ✓/⚠/✗ table. Collect, fix any ⚠/✗ items, re-spawn *only* the affected pass on changed sections.

`subagent_type: general-purpose`, `model: sonnet`, `description`: 3–5 words ("Plan alignment review" / "Plan consistency review").

Per-subagent brief — verbatim in the `prompt`:

```
You are reviewing a draft implementation plan. Read-only — do not edit any files.

INPUTS:
- Source spec (MD): <cwd>/docs/specs/<slug>.md
- Draft impl plan (MD): <cwd>/docs/impl-plans/<slug>.md  (or in-flight draft)
- Checklist (this pass only): below

CHECKLIST — <Pass 1: Alignment | Pass 2: Internal consistency>:
<paste the relevant pass table from skills/implementation-plan-writing/references/self-review-checklist.md>

OUTPUT:
A markdown table: # | Check | Status (✓/⚠/✗) | Note.
For each ⚠ or ✗, the note must be specific — name the step number, the field, or the missing dependency. No vague hand-waves.

Limit your report to 400 words.
```

Surface both reports inline.

## Don'ts

- Don't run inline yourself.
- Don't spawn with `model: opus`.
- Don't let the subagent edit files.
