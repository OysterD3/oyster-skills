---
name: implementation-plan-writing
description: Turn an approved spec into a per-commit step plan with dependency DAG and inline test stubs. Trigger AFTER spec MD approval on "plan the build", "write the impl plan", "what's the build sequence". Self-review for alignment + DAG acyclicity + rollback coverage, HTML preview, MD on approval. Outputs to `docs/impl-plans/`. Deep test review is a separate skill.
---

# Implementation plan writing

The impl plan turns a spec into an executable build sequence. Each step is a unit small enough to commit, large enough to be meaningful. Following the plan top-to-bottom builds the feature; pausing between any two steps leaves the codebase consistent and tested.

## Operating rules

1. **Spec is the input, code is the canvas.** The spec answers *what*; this skill answers *how*. Do not introduce features beyond the spec; do not silently drop spec items.
2. **Per-commit step granularity.** Default: each step is one atomic, PR-worthy unit. Combine tightly-coupled changes (e.g. a type definition plus its single consumer) only when separating them would leave an intermediate state that doesn't compile or pass tests.
3. **Batch independent questions; serialize dependent ones.** Use `AskUserQuestion` (1–4 items). Dependent questions go one at a time. (Same rule as the brainstorming skill.)
4. **Re-read the real code.** Before drafting steps, open the files that will change. Step file paths, function signatures, and test paths must match what's actually there — not what the spec paraphrased.
5. **Test stubs only, not test design.** Each step lists what tests are added and what they cover. Coverage rigor, mock policy, and balance across unit/integration/e2e are the job of the test-review skill that comes next.
6. **Self-review is mandatory.** No HTML render until alignment + consistency come back clean.
7. **HTML before MD.** HTML is the review artifact. MD is the canonical handoff, written only after the user approves the HTML.
8. **No implementation.** Read-only investigation. The only writes are the plan artifacts.

## Workflow checklist

Drive with TodoWrite — one todo per item.

- [ ] **Locate spec input.** Look in `<cwd>/docs/specs/` for the latest MD file (the canonical artifact). Confirm with user: "Using `<filename>` as the source spec. Right one?" If none exists, see [No spec artifact](#no-spec-artifact).
- [ ] **Parse the spec.** Extract: Goal, Acceptance criteria, Behavior, API contracts, Data model, Error handling, Security, Observability, Rollout, Open questions, Implementation notes.
- [ ] **Re-read the real code.** Open every file the spec mentions touching. Record actual paths, current types, current test locations, and the project's test command (whatever the project uses — `npm test`, `jest`, `pytest`, `go test`, etc.). The plan steps must be grounded in real code.
- [ ] **Draft the step sequence.** Apply the [Step template](#step-template) below. Order: types → data layer → services → controllers → workers → integration tests, in general; sequence migrations before code that reads new state.
- [ ] **Build the dependency DAG.** Each step declares which prior steps must complete first. Render as a `flowchart TD` Mermaid diagram in the **Strategy** section.
- [ ] **Identify narrow gaps** that the spec legitimately didn't pin down (backfill strategy, queue choice, feature-flag scope, dependency upgrade). Ask. Batch independent ones (rule #3).
- [ ] **Self-review (delegated, parallel).** Spawn ONE subagent per pass — alignment + internal consistency — in a single message. `model: sonnet`, `subagent_type: general-purpose`, read-only. The fresh-eyes effect catches bias the author can't see. See [Delegated self-review](#delegated-self-review). Collect both reports, surface inline, fix any ⚠/✗ items, re-run *only the affected pass*.
- [ ] **Render HTML** to `<cwd>/docs/impl-plans/<YYYY-MM-DD>-<slug>.html` using `assets/plan.tmpl.html`. Reuse the spec's slug for traceability.
- [ ] **Start the review server** (if not already running). See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Hand off.** Tell the user the URL (`http://localhost:7681/docs/impl-plans/<file>.html`), not the file path. Stop. Do not write the MD.
- [ ] **On approval, write MD** to `<cwd>/docs/impl-plans/<YYYY-MM-DD>-<slug>.md` using `assets/plan.tmpl.md`. Tell the user the path.
- [ ] **Shut the review server down** before handing off to test-review. See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Stop.** Do not start implementation. Mention that the test-review skill is the next link in the chain if the user wants deeper test coverage analysis before coding.

## Chaining

This skill activates after spec approval:

1. **Chained:** spec-writing handed off the MD spec, user reviewed and signaled to proceed. Use the most recently-written spec MD in `<cwd>/docs/specs/`.
2. **Standalone:** user explicitly invokes plan writing. Look for an existing spec; if none, see below.

### No spec artifact

If `<cwd>/docs/specs/` is empty or doesn't exist, stop and ask:

> "There's no spec in `<cwd>/docs/specs/`. Impl plans without a spec tend to ossify decisions that were never explicitly made. Options: (a) run the spec-writing skill first (recommended), (b) proceed standalone — I'll note this in the plan metadata so reviewers know decisions weren't pre-vetted. Which?"

If (b), include in plan metadata: `Spec: none — decisions made during impl planning`.

## Step template

Each step in the plan has these fields. Use `N/A — <reason>` for truly inapplicable fields rather than omitting them.

| Field | Content |
|---|---|
| **Title** | Imperative, ~5–10 words: "Add `archived_at` column to `posts`" |
| **Goal** | One sentence on what this step achieves |
| **Depends on** | Step numbers that must complete first, or "none" |
| **Files** | Each file path + 1-line change description. Use `<code>` for paths. |
| **Changes** | Bullet list of additions/modifications. Be specific: function names, schema fields, route paths, error codes. |
| **Tests** | Test file paths + intent (1 line each). Names only — depth is for test-review. Example: `posts.dal.spec.ts — setArchived toggles column` |
| **Verification** | Concrete command to confirm the step works (use your project's actual tooling). Examples: `npm test posts.dal.spec.ts`, `curl -X POST localhost:8000/...`, `npm run db:migrate` |
| **Rollback** | Required ONLY for steps that change shared state (migrations, schema, feature flags, queue topology, external service config). Example: "Run `npm run db:rollback` to revert migration `0042_add_archived_at.sql`" |
| **Manual** | Optional. Set to `yes — <reason>` for steps that a subagent cannot perform (external dashboard changes, manual DB migration during deploy, secret rotation in vault). Tells the `implementation` skill to surface the step to the user instead of dispatching an agent. Omit for normal code-edit steps. |

### Step ordering heuristics

- Schema migrations BEFORE code that reads the new state
- Types BEFORE the code that uses them
- DAL methods BEFORE services that call them
- Services BEFORE controllers/workers
- A new queue or external integration's *consumer* AFTER its *config and credentials*
- Integration tests at the END of the step group they verify (not at the very end of the plan — they're the gate that proves each layer works)

## Plan-level sections

Beyond the numbered steps:

- **Goal** — verbatim from spec
- **Strategy** — one paragraph on the build approach, plus the dependency DAG diagram
- **Pre-flight** — what must be true before step 1 starts (branch state, env vars, dependencies installed, feature flag created, spec approved)
- **Steps** — the numbered sequence
- **Post-flight** — final checks before merge: full test suite passes, manual smoke test of golden path, no `console.log`/debug code, every spec acceptance criterion exercised. For UI changes: dev server tested in browser per project CLAUDE.md.
- **Risks during execution** — what could go wrong mid-build and how to recover. Example: "If migration locks the table too long in prod, run as `CREATE INDEX CONCURRENTLY` variant in step 1a"
- **Notes** — cross-cutting concerns spanning multiple steps; references to spec sections that informed non-obvious choices

## Question scope

Allowed (HOW-to-build details):
- Migration: backfill default vs nullable column vs separate backfill step?
- Feature flag: per-tenant, per-user, global?
- Queue: reuse existing queue or new dedicated one?
- Should we delete old code path in the same plan, or leave as a follow-up cleanup step?
- Test framework specifics if the codebase has multiple
- Whether step N can run in parallel with step M (DAG verification)

Not allowed (re-litigation):
- Whether to build the feature
- Whether the API contract is correct
- Whether the data model is right
- Whether security mitigations are sufficient

If you want to ask a not-allowed question, instead add an observation in the **Notes** section: "Consider revisiting the dedup approach if write throughput exceeds X."

## Self-review

The review per [references/self-review-checklist.md](references/self-review-checklist.md) defines two passes:

1. **Alignment** — every spec section is reflected in some step, no scope creep.
2. **Internal consistency** — DAG is acyclic, no orphan files, every migration has rollback, ACs are all covered by step tests, step ordering respects dependencies.

These passes are **delegated to subagents**, not run inline — see [Delegated self-review](#delegated-self-review) below.

## Delegated self-review

Spawn ONE subagent per pass, in a **single message** (parallel). Each subagent reads a self-contained brief and returns a ✓/⚠/✗ table. The main agent collects the reports, applies fixes, and re-runs *only* the affected subagent on the changed sections.

Why delegate: fresh eyes (the subagent didn't write the plan), parallel passes halve wall-clock, and Sonnet 4.6 handles the structured walkthrough fine — main agent (Opus) stays on synthesis.

Per-subagent brief — include verbatim in the `prompt`:

```
You are reviewing a draft implementation plan. Read-only — do not edit any files.

INPUTS:
- Source spec (MD): <cwd>/docs/specs/<slug>.md
- Draft impl plan (MD): <cwd>/docs/impl-plans/<slug>.md  (or in-flight draft)
- Checklist (this pass only): below

CHECKLIST — <Pass 1: Alignment | Pass 2: Internal consistency>:
<paste the relevant pass table from skills/implementation-plan-writing/references/self-review-checklist.md>

OUTPUT:
A markdown table with columns: # | Check | Status (✓/⚠/✗) | Note.
For each ⚠ or ✗, the note must be specific — name the step number, the field, or the missing dependency. No vague hand-waves.

Limit your report to 400 words.
```

`subagent_type: general-purpose`, `model: sonnet`, `description`: 3–5 words ("Plan alignment review" / "Plan consistency review").

After both reports return, output them inline so the user sees the rigor. Fix any ⚠/✗ items. Re-spawn only the affected pass; don't re-run the clean one.

**Don't**: run inline yourself. **Don't**: spawn with `model: opus`. **Don't**: let the subagent edit files.

## Output artifacts

### Filenames

- HTML (review): `<cwd>/docs/impl-plans/<YYYY-MM-DD>-<slug>.html`
- MD (canonical): `<cwd>/docs/impl-plans/<YYYY-MM-DD>-<slug>.md`

Reuse the spec's slug for traceability. **If a file with the same name already exists, treat it as a continuation** — read it, prepend a new changelog row (see [Changelog](#changelog)), and update in place on BOTH files together. Don't write `-v2`. If the existing file is unrelated work that genuinely collided, ask the user before clobbering.

### MD template (`assets/plan.tmpl.md`)

Plain markdown with placeholder tokens. Mermaid uses fenced ` ```mermaid ` blocks so it renders on GitHub.

| Placeholder | Content | Notes |
|---|---|---|
| `{{TITLE}}` | Short title | 3–8 words |
| `{{DATE}}` | `YYYY-MM-DD` | |
| `{{STATUS}}` | `Draft` initially, `Approved` after sign-off | |
| `{{SPEC_LINK}}` | Relative link to spec MD, or `none` | `[2026-05-13-foo.md](../specs/2026-05-13-foo.md)` |
| `{{GOAL}}` | One-sentence goal verbatim from spec | |
| `{{STRATEGY}}` | One paragraph + mermaid `flowchart TD` DAG | |
| `{{PREFLIGHT}}` | Bulleted preconditions | |
| `{{STEPS}}` | Numbered list of steps using the [Step template](#step-template) | Each step rendered as a subsection |
| `{{POSTFLIGHT}}` | Bulleted final checks | |
| `{{RISKS}}` | Execution-time risks + mitigations | |
| `{{NOTES}}` | Cross-cutting notes | |
| `{{CHANGELOG_ROWS_MD}}` | One row per revision, newest at top | See [Changelog](#changelog) |

### HTML template (`assets/plan.tmpl.html`)

Dark mode, Mermaid 11 from CDN, same visual language as spec-writing. Each step renders as a card with a numbered badge for at-a-glance scanning.

HTML-only metadata placeholders:

| Placeholder | Format |
|---|---|
| `{{STATUS_HTML}}` | `<span class="status-draft">Draft</span>` or `<span class="status-approved">Approved</span>` |
| `{{SPEC_LINK_HTML}}` | `<a href="../specs/<file>"><file></a>` or `<em>none — standalone plan</em>` |
| `{{STEPS_HTML}}` | Steps as `<article class="step">` cards — see template for the structure |
| `{{CHANGELOG_ROWS}}` | One `<tr>` per revision, newest at top | See [Changelog](#changelog) |

Content rules:

- Use HTML — `<ul>`, `<table>`, `<code>`, `<pre class="code">` — not raw markdown. Escape `<`, `>`, `&` in user-supplied text.
- Code samples (commands, SQL, JSON, type defs): use `<pre class="code" data-lang="<lang>">…</pre>`. The template auto-wraps the content in `<code class="language-<lang>">` and runs highlight.js. Common `data-lang` values: `typescript`, `javascript`, `json`, `sql`, `bash`, `python`, `go`, `yaml`. Omit `data-lang` for auto-detect.
- Wrap diagrams as `<div class="diagram"><pre class="mermaid">…</pre></div>`.
- Each step renders as a card. Use this exact structure (the template's CSS targets these class names):

```html
<article class="step" id="step-1">
  <header class="step-header">
    <span class="step-num">1</span>
    <h3>Add archived_at column to posts</h3>
    <span class="step-deps">depends on: none</span>
  </header>
  <p class="step-goal">Introduce the timestamp the API reads to decide whether a post is hidden from feeds.</p>
  <dl class="step-fields">
    <dt>Files</dt>
    <dd><ul><li><code>src/db/migrations/0042_add_archived_at.sql</code> — new migration</li></ul></dd>
    <dt>Changes</dt>
    <dd><ul><li>Add column <code>archived_at timestamptz NULL</code> to <code>posts</code></li></ul></dd>
    <dt>Tests</dt>
    <dd><ul><li><code>src/db/migrations/__tests__/0042.spec.ts</code> — migration applies and rolls back cleanly</li></ul></dd>
    <dt>Verification</dt>
    <dd><pre class="code">npm run db:migrate &amp;&amp; npm run db:inspect posts</pre></dd>
    <dt>Rollback</dt>
    <dd><code>npm run db:rollback</code> reverts to migration 0041.</dd>
  </dl>
</article>
```

For steps that change shared state (migrations, schema, feature flags, queue topology), add the class `rollback-required` to the `<article>` — the template highlights it with a warn-colored left border so reviewers spot them at a glance.

For manual steps (`Manual: yes — <reason>` in the MD template), render the card with `<span class="step-deps">manual — <reason></span>` in the header and skip the verification command field (subagents won't run it).

## Changelog

Both files include a changelog at the top — HTML in a collapsible `<details>` block, MD as a small markdown table. The changelog is how readers see *what changed since last review* and replaces `-v2` versioning entirely.

**Initial write** — one row in each file.

HTML (`{{CHANGELOG_ROWS}}`):
```html
<tr><td><time>YYYY-MM-DD HH:MM</time></td><td>Initial draft</td></tr>
```

MD (`{{CHANGELOG_ROWS_MD}}`):
```markdown
| 2026-05-13 14:32 | Initial draft |
```

**On every revision** — read the existing file, prepend a new row, write the updated file back.

Rules:
- Timestamp: local time, 24-hour, minute-precision, taken at the moment of the revision.
- Note column: one short sentence — what changed *and* why (cite the comment / new info / user request). For DAG changes, also mention which wave was affected.
- Newest at top. Never delete older rows.
- When the MD is written after HTML approval, copy ALL of the HTML's changelog rows into the MD's `## Changelog` table so the two files agree.

## Revision loop

If the user wants changes after reviewing the HTML:

1. Capture feedback in one batch.
2. Update the relevant steps (and re-check the DAG if dependencies shifted).
3. Re-run self-review on changed sections.
4. **Update the HTML in place** — prepend a new row to the changelog (see [Changelog](#changelog)). No `-v2`.
5. On final approval, write/update the MD in place and copy the changelog rows across so both files agree.

## Review server lifecycle

The HTML review uses the server bundled with the brainstorming skill (`~/.claude/skills/brainstorming/scripts/review-server.mjs`). Comments persist to `<htmlpath>.comments.json` next to the HTML.

### Launching

After writing the HTML, check whether the server is already up — only launch if not.

```bash
curl -sf http://localhost:7681/api/health > /dev/null 2>&1 && echo "already running" || echo "needs start"
```

If `needs start`, launch in background with `Bash` (`run_in_background: true`):

```bash
node ~/.claude/skills/brainstorming/scripts/review-server.mjs
```

Then wait ~1 second and re-check health. If `already running`, skip the launch — reuse it.

Give the user the URL, not the file path:

> Review the plan at **http://localhost:7681/docs/impl-plans/2026-05-13-feature.html**. Highlight any step or text and click "💬 Comment". When done, say "address the comments" or "approve and write the MD".

### Shutting down

After writing the MD and before handing off to test-review:

```bash
curl -sf -X POST http://localhost:7681/api/shutdown > /dev/null
```

## Processing inline comments

When the user says "address the comments", read them from `<htmlpath>.comments.json` directly.

### Reading the comments

Use the Read tool on the comments JSON. Schema:

```json
{
  "file": "docs/impl-plans/2026-05-13-feature.html",
  "comments": [
    {
      "id": "cm1715539200abc",
      "section": "Step: Add controller POST /posts/:id/archive",
      "quote": "Add controller POST /posts/:id/archive",
      "body": "split this — there's also the worker handler logic not covered",
      "ts": "2026-05-13T19:30:00.000Z"
    }
  ]
}
```

Note: comments on step cards have `section: "Step: <title>"`; comments on a section have `section: "<section name>"` (e.g. `Strategy`, `Rollout`).

### Processing each comment

Treat each as a revision request:

1. Use `section` + `quote` together to find the step or section being commented on.
2. Group by intent — *edits*, *step splits/merges* (user thinks a step is too big/small), *dependency changes* (rewire the DAG), *questions*, *proposed-but-unclear*.
3. Apply edits. If the DAG changes, re-derive waves and verify acyclicity. If a step is split, update downstream `Depends on` references.
4. Re-run the self-review on the changed sections.
5. **Update the HTML in place** and prepend a changelog row summarizing what was revised (see [Changelog](#changelog)). Don't write/update the MD until the user re-approves the HTML.
6. In your reply, list each comment with action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.

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
