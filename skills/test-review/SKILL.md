---
name: test-review
description: Two modes — chained mode expands an impl-plan's inline test stubs into a rigorous plan (after impl-plan approval, on "review the tests"/"check coverage"); audit mode scans existing tests in a target directory ("audit tests in X"). Covers unit/integration/e2e split, mock policy (no DB mocks), determinism, security and perf tests. HTML preview, MD on approval, outputs to `docs/test-reviews/`.
---

# Test review

The chain's coverage gate. Impl plan says *what gets built and a stub of tests*; this skill says *which tests actually prove correctness*, in what form, and where.

## Operating rules

1. **Mode-aware.** Two modes with different inputs and slightly different output shapes — see [Modes](#modes). Detect mode before drafting.
2. **No DB mocks. Ever.** Project invariant: integration tests hit a real database. A "mocked DB" in a test that touches data is automatically a ✗ in self-review. Mock external services Claude cannot reach (third-party APIs, paid services, push providers); never mock the project's own Postgres, Redis, or queue.
3. **Tests must be observable, deterministic, isolated.** Every test asserts an observable outcome; no flakes from time/network/randomness; no test depends on another test's state.
4. **Coverage maps trace to a source of truth.** Chained mode: every spec AC has at least one test row. Audit mode: every public function/route in the target surface has at least one test row.
5. **Self-review is mandatory.** No HTML render until alignment + consistency comes back clean.
6. **HTML before MD.** HTML reviewable; MD canonical, written only on approval.
7. **No implementation.** Read-only investigation. Read existing tests, read code, write only the review artifacts.

## Modes

### Chained mode

Triggered after impl-plan approval. The user says "review the tests", "test plan", "let's check coverage", or similar.

- **Input:** the most recently-approved impl plan MD in `<cwd>/docs/impl-plans/`, plus its referenced spec.
- **Goal:** turn the impl plan's inline test stubs into a rigorous, executable test plan. Identify gaps; add tests for security, performance, edge cases that the inline stubs missed.
- **Output sections include:** Per-step test plan (mirroring impl-plan step numbers).

### Audit mode

Triggered when the user asks to audit existing tests in a module or directory: "audit the tests for the Payments module", "check our auth test coverage", "are these tests good enough?".

- **Input:** a target directory or module the user names. Read its existing test files AND its source files to understand the surface being tested.
- **Goal:** report what's tested, what's missed, what's bad (mock-policy violations, flake risks, weak assertions), and what to add.
- **Output sections include:** Surface-area coverage map (function/route → tests → status). No per-step section.

If the user invokes the skill without specifying a mode and both inputs exist (recent impl plan AND a target directory mentioned), ask which mode they want — one question, single-turn.

## Workflow checklist

Drive with TodoWrite — one todo per item.

- [ ] **Detect mode and locate input.** Chained: latest MD in `<cwd>/docs/impl-plans/`. Audit: target directory from the user. Confirm with user before drafting.
- [ ] **Parse input.** Chained: extract step list, test stubs, spec AC list. Audit: list every test file in target, list source files (functions/routes/exports) that constitute the public surface.
- [ ] **Read the actual test files.** Don't trust paraphrase. Open each test file in the relevant scope. Note: framework (Jest/vitest), patterns used (factories, fixtures), what's mocked.
- [ ] **Read the source code being tested.** You can't judge coverage without knowing the branches in the code.
- [ ] **Draft the coverage map** (see [Coverage map](#coverage-map)). Mark each row covered / partial / gap.
- [ ] **Draft per-test entries** with name, type (unit/integration/e2e/security/perf), file path, assertion intent, mock policy.
- [ ] **Run the coverage checklist** in [references/coverage-checklist.md](references/coverage-checklist.md). This is the rigor pass: AC coverage, path coverage, mock policy, determinism, security tests, perf tests.
- [ ] **Ask narrow clarifying questions** for genuine ambiguities (e.g. "is the 100/min rate limit a unit-test concern or a load-test concern?"). Batch independent ones; serialize dependent ones.
- [ ] **Self-review (delegated, parallel).** Spawn ONE subagent per pass — alignment + internal consistency — in a single message. `model: sonnet`, `subagent_type: general-purpose`, read-only. See [Delegated self-review](#delegated-self-review). Collect reports, surface inline, fix any ⚠/✗ items, re-run *only the affected pass*.
- [ ] **Render HTML** to `<cwd>/docs/test-reviews/<YYYY-MM-DD>-<slug>.html` using `assets/review.tmpl.html`. In chained mode, reuse the impl plan's slug. In audit mode, derive slug from the target (`audit-payments`, `audit-auth`).
- [ ] **Start the review server** (if not already running). See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Hand off.** Tell the user the URL (`http://localhost:7681/docs/test-reviews/<file>.html`), not the file path. Stop. Do not write the MD.
- [ ] **On approval, write MD** to `<cwd>/docs/test-reviews/<YYYY-MM-DD>-<slug>.md` using `assets/review.tmpl.md`.
- [ ] **Shut the review server down** before handing off to the implementation skill. See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Stop.** This is the last review skill in the chain. Implementation is the next step — and is the user's call, not yours.

## Coverage map

The coverage map is the centerpiece of every test review. It's a table that maps each item-to-cover to the tests that cover it.

### Chained mode

| AC / behavior | Test name | Type | File | Status |
|---|---|---|---|---|
| AC1: returns 200 + body | `archives an owned post` | integration | `src/posts/posts.controller.spec.ts` | ✓ proposed |
| AC2: rejects unowned post with 403 | — | — | — | ✗ gap |
| Behavior: queue receives purge job | `enqueues purge job after archive` | integration | `src/posts/posts.service.spec.ts` | ✓ proposed |

### Audit mode

| Function / route | Test(s) | Type | Status | Notes |
|---|---|---|---|---|
| `POST /posts/:id/archive` | `archives an owned post (200)`, `403 on unowned` | integration | ✓ covered | |
| `postsDal.setArchived` | `toggles column` | unit | ⚠ partial | no error-path test |
| `purgeWorker.process` | — | — | ✗ gap | no test file exists |

Statuses: ✓ covered · ⚠ partial · ✗ gap. Every row gets one.

## Output sections

The review document has these sections. Use `N/A — <reason>` for inapplicable sections rather than omitting them.

- **Summary** — one paragraph: # tests proposed/existing, # gaps, # mock-policy violations, biggest risk in one line.
- **Coverage map** — the table above.
- **Per-step test plan** (chained mode only) — for each impl plan step: tests inline in the plan, additions from this review with rationale, challenges (e.g. "step 5's test mocks the DB — rewrite to use real DB per project rule").
- **Test inventory** — every test grouped by type (unit / integration / e2e / security / performance). Each entry: name, file path, intent in one line.
- **Mock policy audit** — list every mock in the proposed or existing tests. For each: target (what's mocked), justification, verdict (✓ acceptable · ✗ violates project rule).
- **Determinism review** — patterns that cause flakes: clock dependence (`Date.now`, `new Date()`), network calls without mocks (for external services), random data without seed, order-dependent tests. List each instance and the fix.
- **Security tests** — for every Security item in the spec, the test that exercises it (auth bypass, input fuzzing, injection attempt, rate-limit verification).
- **Performance tests** — only when applicable (rate limits, batch operations, queue depth, large data). One test per perf-sensitive spec item.
- **Gaps & risks** — ranked. What's NOT covered and what that means.
- **Recommendations** — concrete test files/cases to add, with file paths and one-line intents.

## Question scope

Allowed (test-design ambiguities):
- "Is the 100/min rate limit a unit-test concern or a load-test concern?"
- "Should the webhook signature verification have unit tests, integration tests, or both?"
- "Should we test the worker via `worker.process(job)` directly, or by enqueueing and waiting?"
- "Is this third-party API behind a fixture, or a real-but-rate-limited integration?"

Not allowed (out of scope):
- Whether the feature itself is needed (brainstorming's job)
- Whether the impl plan's step ordering is right (impl-plan-writing's job)
- Whether to use a different test framework
- Whether the spec AC is correct

If you want to ask a not-allowed question, instead add an observation in **Gaps & risks**: "AC3 is hard to test as written — consider tightening to X in a future spec revision."

## Self-review

Run BEFORE rendering HTML. Two passes, **delegated to subagents** — see [Delegated self-review](#delegated-self-review) below.

### Pass 1 — Alignment

- **Chained mode:** every impl plan step's tests are reviewed; every spec AC has a coverage map row; no impl-plan step is silently dropped; security spec items have security tests; performance spec items have perf tests.
- **Audit mode:** every public function/route in the target's surface has a row; no source file is skipped.

### Pass 2 — Internal consistency

- Every test in the inventory appears in the coverage map (no orphan tests).
- Every coverage map row references a test that exists in the inventory (no phantom references).
- Every mock listed in the mock-policy audit is justified, or the row is marked ✗ with a rewrite recommendation.
- No DB mock is marked ✓ in the policy audit (project invariant).
- Every determinism risk has a fix in the review.
- Every gap in the coverage map appears in **Gaps & risks** or **Recommendations**.
- Test names describe behavior, not implementation (e.g. "rejects unowned post", not "calls hasAccess()").

## Delegated self-review

Spawn ONE subagent per pass, in a **single message** (parallel). Each subagent returns a ✓/⚠/✗ table. The main agent collects reports, applies fixes, and re-runs *only* the affected subagent on the changed sections.

Why delegate: fresh eyes (the subagent didn't write the review), parallel passes halve wall-clock, and Sonnet 4.6 handles the structured walkthrough fine — main agent (Opus) stays on synthesis.

Per-subagent brief — include verbatim in the `prompt`:

```
You are reviewing a draft test-review document. Read-only — do not edit any files.

INPUTS:
- Source spec (MD): <cwd>/docs/specs/<slug>.md   (chained mode)
- Source impl plan (MD): <cwd>/docs/impl-plans/<slug>.md   (chained mode)
- Target module/dir: <path>   (audit mode)
- Draft test-review (MD): <cwd>/docs/test-reviews/<slug>.md  (or in-flight draft)
- Checklist (this pass only): below

CHECKLIST — <Pass 1: Alignment | Pass 2: Internal consistency>:
<paste the relevant bullets from the Self-review section of skills/test-review/SKILL.md>

OUTPUT:
A markdown table with columns: # | Check | Status (✓/⚠/✗) | Note.
For each ⚠ or ✗, the note must be specific — name the test, the AC, the function, or the mock that triggered the flag.

Limit your report to 400 words.
```

`subagent_type: general-purpose`, `model: sonnet`, `description`: 3–5 words ("Test-review alignment" / "Test-review consistency").

After both reports return, output them inline. Fix any ⚠/✗ items. Re-spawn only the affected pass.

**Don't**: run inline yourself. **Don't**: spawn with `model: opus`. **Don't**: let the subagent edit files.

## Output artifacts

### Filenames

- HTML (review): `<cwd>/docs/test-reviews/<YYYY-MM-DD>-<slug>.html`
- MD (canonical): `<cwd>/docs/test-reviews/<YYYY-MM-DD>-<slug>.md`

Slug rules:
- Chained: reuse the impl plan's slug.
- Audit: prefix with `audit-` plus the target name (`audit-payments`, `audit-auth-module`).
- **If a file with the same name already exists, treat it as a continuation** — read it, prepend a new changelog row (see [Changelog](#changelog)), and update in place on BOTH files together. Don't write `-v2`. If the existing file is unrelated work that genuinely collided, ask the user before clobbering.

### MD template (`assets/review.tmpl.md`)

Standard markdown. Tables for coverage maps. Mermaid in fenced ` ```mermaid ` blocks if a coverage diagram aids understanding (optional — usually the table is enough).

| Placeholder | Content |
|---|---|
| `{{TITLE}}` | Short title (chained: feature name; audit: "Test audit — <target>") |
| `{{DATE}}` | `YYYY-MM-DD` |
| `{{STATUS}}` | `Draft` then `Approved` |
| `{{MODE}}` | `Chained` or `Audit` |
| `{{SOURCE_LINK}}` | Link to impl plan (chained) or target path (audit) |
| `{{SUMMARY}}` | One paragraph summary |
| `{{COVERAGE_MAP}}` | Coverage table |
| `{{PER_STEP_TESTS}}` | Per-step test plan (chained only; `N/A — audit mode` otherwise) |
| `{{TEST_INVENTORY}}` | Grouped by type |
| `{{MOCK_AUDIT}}` | Mock policy table |
| `{{DETERMINISM}}` | Determinism review |
| `{{SECURITY_TESTS}}` | Security tests section |
| `{{PERF_TESTS}}` | Performance tests section |
| `{{GAPS_RISKS}}` | Ranked gaps |
| `{{RECOMMENDATIONS}}` | Concrete test files to add |
| `{{CHANGELOG_ROWS_MD}}` | One row per revision, newest at top — see [Changelog](#changelog) |

### HTML template (`assets/review.tmpl.html`)

Dark mode, Mermaid 11 from CDN, same visual language as the rest of the chain. Coverage map renders with status badges: green ✓, yellow ⚠, red ✗ — colors auto-applied via CSS when the cell uses the right class.

HTML-only placeholders:

| Placeholder | Format |
|---|---|
| `{{STATUS_HTML}}` | `<span class="status-draft">Draft</span>` or `<span class="status-approved">Approved</span>` |
| `{{MODE_HTML}}` | `<span class="mode-chained">Chained</span>` or `<span class="mode-audit">Audit</span>` |
| `{{SOURCE_LINK_HTML}}` | `<a href="..">file</a>` |
| `{{CHANGELOG_ROWS}}` | One `<tr>` per revision, newest at top — see [Changelog](#changelog) |

Coverage map status cells must use the right class for color coding:

```html
<td class="status-ok">✓ proposed</td>
<td class="status-warn">⚠ partial</td>
<td class="status-gap">✗ gap</td>
```

Test inventory entries use:

```html
<article class="test-entry">
  <span class="test-type test-type-unit">unit</span>
  <span class="test-name">archives an owned post</span>
  <code class="test-file">src/posts/posts.controller.spec.ts</code>
  <p class="test-intent">Asserts 200 + correct response body for the happy path.</p>
</article>
```

Test type classes: `test-type-unit`, `test-type-integration`, `test-type-e2e`, `test-type-security`, `test-type-perf`.

Code excerpts (test snippets, command samples): use `<pre class="code" data-lang="<lang>">…</pre>`. The template auto-wraps the content in `<code class="language-<lang>">` and runs highlight.js. Common `data-lang` values: `typescript`, `javascript`, `python`, `go`, `bash`, `json`. Omit `data-lang` for auto-detect.

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
- Note column: one short sentence — what changed *and* why (cite the comment / new info / user request).
- Newest at top. Never delete older rows.
- When the MD is written after HTML approval, copy ALL of the HTML's changelog rows into the MD's `## Changelog` table so the two files agree.

## Revision loop

If user wants changes after the HTML review:

1. Capture feedback in one batch.
2. Update the relevant sections.
3. Re-run self-review on changed sections.
4. **Update the HTML in place** and prepend a new row to the changelog (see [Changelog](#changelog)). No `-v2`.
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

> Review the test plan at **http://localhost:7681/docs/test-reviews/2026-05-13-feature.html**. Highlight any test entry, coverage row, or section and click "💬 Comment". When done, say "address the comments" or "approve and write the MD".

### Shutting down

After writing the MD and before handing off to implementation:

```bash
curl -sf -X POST http://localhost:7681/api/shutdown > /dev/null
```

## Processing inline comments

When the user says "address the comments", read them from `<htmlpath>.comments.json` directly.

### Reading the comments

Use the Read tool on the comments JSON. Schema:

```json
{
  "file": "docs/test-reviews/2026-05-13-feature.html",
  "comments": [
    {
      "id": "cm1715539200abc",
      "section": "Test: archives an owned post",
      "quote": "archives an owned post",
      "body": "this test mocks the DB — rewrite to use real DB per project rule",
      "ts": "2026-05-13T19:30:00.000Z"
    }
  ]
}
```

Note: comments on test entries have `section: "Test: <name>"`; comments on a section have `section: "<section name>"` (e.g. `Coverage map`, `Mock policy audit`).

### Processing each comment

Treat each as a revision request:

1. Use `section` + `quote` together to identify the test entry, coverage row, or section being commented on.
2. Group by intent — *test additions* ("we also need a test for X"), *test challenges* ("this test mocks the DB — rewrite"), *recategorizations* (e.g. unit → integration), *coverage corrections* (status was wrong), *questions*, *proposed-but-unclear*.
3. Apply edits to the working review. If a comment challenges a mock-policy verdict, re-run the relevant items of the coverage checklist.
4. Re-run the self-review on the changed sections.
5. **Update the HTML in place** and prepend a changelog row summarizing what was revised (see [Changelog](#changelog)). Don't write/update the MD until the user re-approves the HTML.
6. In your reply, list each comment with action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.

## Anti-patterns

| Don't | Do |
|---|---|
| Allow a mock around the project's Postgres or Redis | Mark it ✗ in mock policy audit and recommend rewrite as a real-DB integration test. Project rule. |
| Mark a test "covered" without checking the assertion | Read the test. A test that calls a function but asserts nothing meaningful is a gap, not coverage. |
| Suggest 100% coverage as the target | Risk-based coverage. Hot paths and security items need rigor; trivial getters don't. |
| Add unit tests for code that's only meaningfully testable as integration | Match the test type to what's being verified. |
| Test names that describe implementation | "calls hasAccess()" → "rejects unowned post". The name describes observable behavior. |
| Skip the determinism review because tests "look fine" | Flakes hide here. Always scan for `Date.now`, network calls, unseeded randomness, order coupling. |
| Run the project's test command to "verify coverage" | Read-only skill. Tests are run by the engineer during implementation, not during review. |
