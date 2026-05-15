---
name: spec-writing
description: Turn an approved brainstorming HTML into a Markdown engineering spec. Trigger AFTER brainstorming sign-off when user says "move on to spec", "write the spec", or asks explicitly. Asks narrow clarifying questions only for spec-level gaps (exact types, error codes, validation rules), runs alignment + consistency self-review, HTML preview first, MD on approval. Outputs to `docs/specs/`.
---

# Spec writing

The spec is the engineering contract. After sign-off, implementation should be possible without re-deriving any decision.

## TL;DR

- **Input:** approved brainstorming artifact in `docs/brainstorming/`.
- **Output:** HTML preview first, then Markdown canonical (`docs/specs/`).
- **Adds on top of brainstorming:** files, types, status codes, validation bounds, acceptance criteria, observability, rollout.
- **Narrow questions only.** No re-litigating architectural decisions.
- **Self-review delegated:** parallel Sonnet subagents (alignment + consistency) before render.

## Operating rules

1. **Brainstorming is input, not canvas.** Don't re-litigate decisions. Flag disagreements as a single observation; let the user choose.
2. **Narrow questions only.** Spec-level details brainstorming couldn't have answered (types, error codes, bounds, AC edges, observability specifics). Never re-ask architectural questions.
3. **Batch independent; serialize dependent.** 1–4 per `AskUserQuestion`. Dependent = A's answer reshapes B → ask A alone.
4. **Self-review is mandatory.** Delegated to subagents. No HTML render until both passes are clean.
5. **HTML before MD.** HTML is the review artifact; MD is the source of truth, written only after HTML approval.
6. **No implementation.** Read-only investigation; only writes are the spec artifacts.

## Workflow checklist

Drive this with TodoWrite — one todo per item.

- [ ] **Locate brainstorming input.** Look in `<cwd>/docs/brainstorming/` for the latest HTML. Confirm with user: "Using `<filename>` as the source. Right one?" If none exists, see [Chaining](#chaining).
- [ ] **Parse brainstorming.** Extract: Goal, Context, Approaches considered, Approach (+ any diagram), Decisions (Decision/Picked/Rejected/Why rows), Tradeoffs & out-of-scope, Open questions, Security pass decisions. Brainstorming is **approach-only** — files/types/codes are derived here.
- [ ] **Read the relevant code.** Ground the approach in reality: open the modules implied, note existing types, function signatures, error shapes, similar features. The list of files to touch and concrete contract shapes are produced *here*, not inherited.
- [ ] **Draft the spec internally.** Map brainstorming → spec per [Brainstorming → spec mapping](#brainstorming--spec-mapping). Identify gaps needing narrow clarifying questions.
- [ ] **Ask narrow clarifying questions** for legitimate spec-level gaps. ONE at a time. See [Question scope](#question-scope). Skip if none.
- [ ] **Self-review (delegated, parallel).** Spawn ONE subagent per pass — alignment + internal consistency — in a single message. See [references/self-review.md](references/self-review.md). Collect both reports, surface inline, fix any ⚠/✗ items, re-run *only* the affected pass.
- [ ] **Render HTML** to `<cwd>/docs/specs/<YYYY-MM-DD>-<slug>.html` using `assets/spec.tmpl.html`. See [references/output-artifacts.md](references/output-artifacts.md). Reuse brainstorming slug when continuing the same thread.
- [ ] **Start the review server** (if not already running). See [_shared/references/review-server.md](../_shared/references/review-server.md).
- [ ] **Hand off for review.** Tell the user the URL (`http://localhost:7681/docs/specs/<file>.html`), not the path. Stop and wait. Do not write the MD yet.
- [ ] **On approval, write MD** to `<cwd>/docs/specs/<YYYY-MM-DD>-<slug>.md` using `assets/spec.tmpl.md`. Tell the user the path. This is the canonical artifact.
- [ ] **Shut the review server down** before handing off to impl-plan-writing.
- [ ] **Stop.** Do not start implementation. The spec exists to be referenced, not to chain forward automatically.

For revisions after the user comments on the HTML, see [references/inline-comments.md](references/inline-comments.md) and the revision loop in [references/output-artifacts.md](references/output-artifacts.md).

## Chaining

This skill activates two ways:

1. **Chained** — brainstorming handed off, user signaled to proceed ("looks good, move on", "write the spec"). Use the most recently-written brainstorming artifact as input.
2. **Standalone** — user invokes spec writing without a fresh brainstorming session. Look for an existing brainstorming artifact.

**No brainstorming artifact?** Stop and ask:

> "There's no brainstorming artifact in `<cwd>/docs/brainstorming/`. Specs without a prior brainstorming pass tend to ship with unexamined assumptions. Options: (a) run the brainstorming skill first (recommended), (b) proceed standalone — I'll note this in the spec metadata so reviewers know decisions weren't pre-vetted. Which?"

If (b), include in the spec metadata: `Brainstorming: none — decisions made during spec writing`.

## Question scope

**Allowed** (spec-level details brainstorming couldn't answer):

- Exact field types, lengths, formats (`uuid` vs `ulid` vs `string`)
- HTTP status codes for specific error cases
- Validation bounds (min/max, regex shape)
- Pagination strategy (cursor vs offset, page size cap)
- AC edge cases ("does empty input return 200 with empty array, or 400?")
- Observability specifics (which metric, which log level, which alert threshold)
- Idempotency key derivation (which fields, hashed how)

**Not allowed** (re-litigation):

- Whether to do the feature at all
- Which approach to take among options brainstorming closed on
- Whether the architecture is correct
- Scope changes

Tempted to ask a not-allowed question? Instead: add a single observation to the spec's **Implementation notes** ("Consider revisiting X if Y becomes a problem in practice") and move on.

## Brainstorming → spec mapping

Brainstorming gives the **approach** + reasoning. The spec adds the **implementation contract** (files, types, codes, observability).

| Brainstorming section | Spec section(s) |
|---|---|
| Goal | **Goal** (verbatim or tightened) |
| Context | Folds into **Goal** preamble or **Implementation notes** opening — don't lose the "why now" framing |
| Approaches considered | Folds into **Implementation notes** as a one-paragraph "approach selection" note: which option won and why, with rejected options named. Don't re-litigate — it's signed off. |
| Approach (prose + optional diagram) | **Behavior** — refine the diagram with concrete endpoints, error names, state labels |
| Decisions (Decision/Picked/Rejected/Why) | *Picked* drives **API contracts**, **Data model**, **Error handling**, **Rollout**, or **Security** depending on the decision. Preserve *Why* inline as short rationale where each decision lands. |
| Tradeoffs & out of scope | OUT items → **Out of scope** (verbatim or near). ACCEPT items → **Implementation notes** as documented compromises, with brainstorming "why" preserved. |
| Open questions | Resolved → folds into **Behavior**/**Error handling**/etc. Unresolved → **Open questions** with residual-risk note. |
| Security pass decisions | **Security** (each row becomes a concrete, testable requirement) |
| Security: deferred items | **Open questions** with explicit residual-risk note |

**Files, exact types, status codes, validation bounds** are NOT in brainstorming — derive them here from code reading + Decisions.

**Acceptance criteria** is new in the spec — derive from goal + out-of-scope. Each one observable and testable.

## Anti-patterns

| Don't | Do |
|---|---|
| Copy brainstorming verbatim into the spec | Tighten and elaborate. Spec is more precise: types, codes, thresholds. |
| Skip self-review because "it looks fine" | Delegate it. The fresh-eyes effect catches what the author can't see; spawning two Sonnet subagents in parallel costs almost nothing. |
| Render HTML with `⚠` items still open | Fix first, render after. |
| Write the MD when the user hasn't approved the HTML | HTML first. MD only after explicit go. |
| Ask 3 clarifying questions in one turn | One at a time. If you can't pick the most important one, the spec isn't drafted enough yet. |
| Re-open architectural debates | Add an observation to Implementation notes, move on. |
