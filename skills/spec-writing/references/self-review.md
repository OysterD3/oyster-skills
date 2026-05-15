# Self-review

Two passes — both **delegated to parallel Sonnet subagents**, not run inline.

The detail of what each pass checks lives in [self-review-checklist.md](self-review-checklist.md):

1. **Alignment** — every brainstorming decision is reflected in the spec; nothing silently dropped.
2. **Internal consistency** — spec doesn't contradict itself (API codes defined, fields exist, ACs cover the goal, security mitigations are testable).

## Why delegate

- **Fresh eyes** — the subagent didn't draft the spec, so no "of course I covered that" bias.
- **Parallel** — alignment and consistency are independent; concurrent halves wall-clock.
- **Token isolation** — Sonnet 4.6 handles the structured walkthrough; main agent (Opus) stays on synthesis.

## How

Spawn ONE subagent per pass in a **single message** (so they run in parallel). Each returns a ✓/⚠/✗ table. Collect both reports, fix any ⚠/✗ items, re-spawn *only* the affected pass on changed sections.

`subagent_type: general-purpose`, `model: sonnet`, `description`: 3–5 words ("Spec alignment review" / "Spec consistency review").

Per-subagent brief — include verbatim in the `prompt` (no conversation history):

```
You are reviewing a draft engineering spec. Read-only — do not edit any files.

INPUTS:
- Brainstorming source: <cwd>/docs/brainstorming/<slug>.content.json
- Draft spec (Markdown): <cwd>/docs/specs/<slug>.md   (or the in-flight draft)
- Checklist (this pass only): below

CHECKLIST — <Pass 1: Alignment | Pass 2: Internal consistency>:
<paste the relevant pass table from skills/spec-writing/references/self-review-checklist.md>

OUTPUT:
A markdown table: # | Check | Status (✓/⚠/✗) | Note.
For each ⚠ or ✗, the note must be specific — name the section, field, or contradicting line. No vague hand-waves.

Limit your report to 400 words.
```

After both reports return, output them inline so the user sees the rigor.

## Don'ts

- Don't run the review inline yourself.
- Don't spawn with `model: opus`.
- Don't let the subagent edit files (it's read-only by design).
