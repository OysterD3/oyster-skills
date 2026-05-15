---
name: implementation-plan-writing
description: Turn an approved spec into a per-commit step plan with dependency DAG and inline test stubs. Trigger AFTER spec MD approval on "plan the build", "write the impl plan", "what's the build sequence". Self-review for alignment + DAG acyclicity + rollback coverage, HTML preview, MD on approval. Outputs to `docs/impl-plans/`. Deep test review is a separate skill.
---

# Implementation plan writing

Turn an approved spec into an executable build sequence. Each step is small enough to commit, large enough to be meaningful. Pausing between any two steps leaves the codebase consistent and tested.

## TL;DR

- **Input:** approved spec MD in `docs/specs/`.
- **Output:** HTML preview, then Markdown canonical (`docs/impl-plans/`) — feeds the implementation skill.
- **Granularity:** per-commit. Each step is one atomic, PR-worthy unit.
- **Steps include:** files, changes, test stubs (names only), verification command, rollback if applicable.
- **DAG-aware:** declare `depends on` per step; the implementation skill uses the DAG to parallelize.
- **Self-review delegated:** parallel Sonnet subagents (alignment + consistency) before render.

## Operating rules

1. **Spec is input, code is canvas.** Spec answers *what*; this skill answers *how*. No new features, no silent drops.
2. **Per-commit granularity.** One atomic unit per step. Combine only if separating leaves an uncompilable/untested state.
3. **Batch independent; serialize dependent.** 1–4 per `AskUserQuestion`.
4. **Re-read the real code.** Paths, signatures, test locations must match reality — not the spec's paraphrase.
5. **Test stubs only, not test design.** Names + intent. Depth (coverage, mocks, unit/integration balance) is test-review's job.
6. **Self-review is mandatory.** Delegated to subagents. No HTML render until clean.
7. **HTML before MD.** MD only written after HTML approval.
8. **No implementation.** Read-only investigation; only writes are the plan artifacts.

## Workflow checklist

Drive with TodoWrite — one todo per item.

- [ ] **Locate spec input.** Look in `<cwd>/docs/specs/` for the latest MD file. Confirm: "Using `<filename>` as the source spec. Right one?" If none, see [Chaining](#chaining).
- [ ] **Parse the spec.** Extract: Goal, Acceptance criteria, Behavior, API contracts, Data model, Error handling, Security, Observability, Rollout, Open questions, Implementation notes.
- [ ] **Re-read the real code.** Open every file the spec mentions. Record actual paths, current types, current test locations, and the project's test command (`npm test`, `jest`, `pytest`, `go test`, etc.). Plan steps must be grounded in real code.
- [ ] **Draft the step sequence.** Apply the [Step template](#step-template). General order: types → data layer → services → controllers → workers → integration tests. Migrations before code that reads new state.
- [ ] **Build the dependency DAG.** Each step declares which prior steps must complete first. Render as a `flowchart TD` Mermaid diagram in the **Strategy** section.
- [ ] **Identify narrow gaps** the spec legitimately didn't pin down (backfill strategy, queue choice, feature-flag scope, dep upgrade). Ask. Batch independent ones.
- [ ] **Self-review (delegated, parallel).** Spawn ONE subagent per pass in a single message. See [references/self-review.md](references/self-review.md). Collect reports, fix ⚠/✗ items, re-run *only* the affected pass.
- [ ] **Render HTML** to `<cwd>/docs/impl-plans/<YYYY-MM-DD>-<slug>.html` using `assets/plan.tmpl.html`. See [references/output-artifacts.md](references/output-artifacts.md). Reuse the spec's slug.
- [ ] **Start the review server** (if not already running). See [_shared/references/review-server.md](../_shared/references/review-server.md).
- [ ] **Hand off.** Tell the user the URL (`http://localhost:7681/docs/impl-plans/<file>.html`), not the path. Stop. Do not write the MD.
- [ ] **On approval, write MD** to `<cwd>/docs/impl-plans/<YYYY-MM-DD>-<slug>.md` using `assets/plan.tmpl.md`. Tell the user the path.
- [ ] **Shut the review server down** before handing off to test-review.
- [ ] **Stop.** Do not start implementation. Mention that test-review is the next link if the user wants deeper coverage analysis before coding.

For revisions after HTML comments, see [references/inline-comments.md](references/inline-comments.md) and the revision loop in [references/output-artifacts.md](references/output-artifacts.md).

## Chaining

This skill activates after spec approval:

1. **Chained** — spec-writing handed off, user signaled to proceed. Use the most recent spec MD in `<cwd>/docs/specs/`.
2. **Standalone** — user invokes plan writing directly. Look for an existing spec; if none, ask.

**No spec artifact?** Stop and ask:

> "There's no spec in `<cwd>/docs/specs/`. Impl plans without a spec tend to ossify decisions that were never explicitly made. Options: (a) run the spec-writing skill first (recommended), (b) proceed standalone — I'll note this in the plan metadata so reviewers know decisions weren't pre-vetted. Which?"

If (b), include in plan metadata: `Spec: none — decisions made during impl planning`.

## Step template

Each step has these fields. Use `N/A — <reason>` for truly inapplicable fields rather than omitting.

| Field | Content |
|---|---|
| **Title** | Imperative, ~5–10 words: "Add `archived_at` column to `posts`" |
| **Goal** | One sentence on what this step achieves |
| **Depends on** | Step numbers that must complete first, or "none" |
| **Files** | Each file path + 1-line change description. Use `<code>` for paths. |
| **Changes** | Bullet list of additions/modifications. Specific: function names, schema fields, route paths, error codes. |
| **Tests** | Test file paths + intent (1 line each). Names only — depth is test-review's job. Example: `posts.dal.spec.ts — setArchived toggles column` |
| **Verification** | Concrete command to confirm the step works. Examples: `npm test posts.dal.spec.ts`, `curl -X POST localhost:8000/...`, `npm run db:migrate` |
| **Rollback** | Required ONLY for steps changing shared state (migrations, schema, feature flags, queue topology, external service config). Example: "Run `npm run db:rollback` to revert migration `0042_add_archived_at.sql`" |
| **Manual** | Optional. `yes — <reason>` for steps a subagent can't perform (external dashboard, manual migration during deploy, vault secret rotation). Tells the implementation skill to surface to the user instead of dispatching an agent. Omit for normal code edits. |

### Step ordering heuristics

- Schema migrations BEFORE code that reads the new state.
- Types BEFORE the code that uses them.
- DAL methods BEFORE services that call them.
- Services BEFORE controllers/workers.
- A new queue/external integration's *consumer* AFTER its *config and credentials*.
- Integration tests at the END of the step group they verify (not at the very plan-end — they're the gate that proves each layer works).

## Plan-level sections

Beyond the numbered steps:

- **Goal** — verbatim from spec.
- **Strategy** — one paragraph on the build approach, plus the dependency DAG diagram.
- **Pre-flight** — what must be true before step 1 (branch state, env vars, deps installed, feature flag created, spec approved).
- **Steps** — the numbered sequence.
- **Post-flight** — final checks before merge: full test suite passes, manual smoke test of golden path, no `console.log`/debug code, every spec AC exercised. For UI changes: dev server tested in browser per project CLAUDE.md.
- **Risks during execution** — what could go wrong mid-build and how to recover. Example: "If migration locks the table too long in prod, run as `CREATE INDEX CONCURRENTLY` variant in step 1a."
- **Notes** — cross-cutting concerns; references to spec sections that informed non-obvious choices.

## Question scope

**Allowed** (HOW-to-build details):

- Migration: backfill default vs nullable column vs separate backfill step?
- Feature flag: per-tenant, per-user, global?
- Queue: reuse existing or new dedicated one?
- Delete old code path in the same plan, or leave as follow-up cleanup?
- Test framework specifics if the codebase has multiple.
- Whether step N can run in parallel with step M (DAG verification).

**Not allowed** (re-litigation):

- Whether to build the feature.
- Whether the API contract is correct.
- Whether the data model is right.
- Whether security mitigations are sufficient.

Tempted to ask a not-allowed question? Add an observation in the **Notes** section: "Consider revisiting the dedup approach if write throughput exceeds X."

## Anti-patterns

| Don't | Do |
|---|---|
| Make steps too coarse (one step = "build the feature") | Break into per-commit units. If a single step's diff would exceed ~300 lines, split it. |
| Make steps too granular (one step = "import a type") | Combine tightly-coupled changes when separating them creates an inconsistent intermediate state. |
| List "write tests" as a final step | Tests live with the code they verify, in the same step. |
| Skip the DAG diagram | Render it — reviewers spot ordering errors visually that they miss in prose. |
| Forget rollback on migration steps | Every shared-state change has a rollback line. |
| Re-design the API contract | Out of scope. Add a Note: "Consider revisiting X post-launch." |
| Author deep test plans inline | Stubs only. Test-review skill handles coverage rigor. |
