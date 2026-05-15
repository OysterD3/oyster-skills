---
name: test-review
description: Two modes — chained mode expands an impl-plan's inline test stubs into a rigorous plan (after impl-plan approval, on "review the tests"/"check coverage"); audit mode scans existing tests in a target directory ("audit tests in X"). Covers unit/integration/e2e split, mock policy (no DB mocks), determinism, security and perf tests. HTML preview, MD on approval, outputs to `docs/test-reviews/`.
---

# Test review

The chain's coverage gate. Impl plan says *what gets built + test stubs*; this skill says *which tests actually prove correctness*, in what form, and where.

## TL;DR

- **Two modes:** chained (after impl-plan approval) or audit (existing tests in a module/dir).
- **Output:** coverage map + test inventory + mock-policy audit + determinism review. HTML preview, then MD (`docs/test-reviews/`).
- **No DB mocks.** Integration tests hit a real DB. Mocked-DB = automatic ✗.
- **Every test is observable, deterministic, isolated.** No time/network/randomness flakes; no test depends on another's state.
- **Coverage maps trace to a source of truth.** Chained: spec ACs. Audit: every public function/route in the target.
- **Self-review delegated:** parallel Sonnet subagents (alignment + consistency).

## Operating rules

1. **Mode-aware.** Detect mode before drafting — see [Modes](#modes).
2. **No DB mocks, ever.** Project invariant; auto-✗ in self-review. Mock unreachable third-party APIs only; never the project's own Postgres/Redis/queue.
3. **Tests must be observable, deterministic, isolated.**
4. **Coverage traces to a source of truth.** Chained: every AC has a row. Audit: every public surface item has a row.
5. **Self-review is mandatory.** Delegated to subagents. No HTML render until clean.
6. **HTML before MD.** MD only on approval.
7. **No implementation.** Read-only; only writes are the review artifacts.

## Modes

### Chained mode

Triggered after impl-plan approval. User says "review the tests", "test plan", "let's check coverage", or similar.

- **Input:** the most recently-approved impl plan MD in `<cwd>/docs/impl-plans/`, plus its referenced spec.
- **Goal:** turn the impl plan's inline test stubs into a rigorous, executable test plan. Identify gaps; add tests for security, performance, edge cases that the inline stubs missed.
- **Output sections include:** Per-step test plan (mirroring impl-plan step numbers).

### Audit mode

Triggered when the user asks to audit existing tests in a module or directory ("audit the tests for the Payments module", "check our auth test coverage", "are these tests good enough?").

- **Input:** a target directory or module. Read its existing test files AND its source files to understand the surface being tested.
- **Goal:** report what's tested, what's missed, what's bad (mock-policy violations, flake risks, weak assertions), and what to add.
- **Output sections include:** Surface-area coverage map (function/route → tests → status). No per-step section.

If both inputs exist and the user didn't specify, ask which mode — one question, single-turn.

## Workflow checklist

Drive with TodoWrite — one todo per item.

- [ ] **Detect mode and locate input.** Chained: latest MD in `<cwd>/docs/impl-plans/`. Audit: target directory from the user. Confirm before drafting.
- [ ] **Parse input.** Chained: step list, test stubs, spec AC list. Audit: every test file in target + source files (functions/routes/exports) that form the public surface.
- [ ] **Read the actual test files.** Don't trust paraphrase. Open each test file in scope. Note framework (Jest/vitest), patterns (factories, fixtures), what's mocked.
- [ ] **Read the source code being tested.** Can't judge coverage without knowing the branches in the code.
- [ ] **Draft the coverage map** (see [Coverage map](#coverage-map)). Mark each row covered / partial / gap.
- [ ] **Draft per-test entries** with name, type (unit/integration/e2e/security/perf), file path, assertion intent, mock policy.
- [ ] **Run the coverage checklist** in [references/coverage-checklist.md](references/coverage-checklist.md). Rigor pass: AC coverage, path coverage, mock policy, determinism, security tests, perf tests.
- [ ] **Ask narrow clarifying questions** for genuine ambiguities. Batch independent; serialize dependent.
- [ ] **Self-review (delegated, parallel).** Spawn ONE subagent per pass in a single message. See [references/self-review.md](references/self-review.md). Collect reports, fix ⚠/✗ items, re-run *only* the affected pass.
- [ ] **Render HTML** to `<cwd>/docs/test-reviews/<YYYY-MM-DD>-<slug>.html` using `assets/review.tmpl.html`. See [references/output-artifacts.md](references/output-artifacts.md). Chained: reuse impl plan's slug. Audit: prefix with `audit-` + target name (`audit-payments`).
- [ ] **Start the review server** (if not already running). See [_shared/references/review-server.md](../_shared/references/review-server.md).
- [ ] **Hand off.** Tell the user the URL (`http://localhost:7681/docs/test-reviews/<file>.html`), not the path. Stop. Do not write the MD.
- [ ] **On approval, write MD** to `<cwd>/docs/test-reviews/<YYYY-MM-DD>-<slug>.md` using `assets/review.tmpl.md`.
- [ ] **Shut the review server down** before handing off to the implementation skill.
- [ ] **Stop.** Last review skill in the chain. Implementation is the next step — and is the user's call.

For revisions after HTML comments, see [references/inline-comments.md](references/inline-comments.md) and the revision loop in [references/output-artifacts.md](references/output-artifacts.md).

## Coverage map

The centerpiece of every test review. A table mapping each item-to-cover to the tests that cover it.

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

Use `N/A — <reason>` for inapplicable sections rather than omitting.

- **Summary** — one paragraph: # tests proposed/existing, # gaps, # mock-policy violations, biggest risk in one line.
- **Coverage map** — the table above.
- **Per-step test plan** (chained only) — for each impl plan step: tests inline in the plan, additions from this review with rationale, challenges (e.g. "step 5's test mocks the DB — rewrite to use real DB per project rule").
- **Test inventory** — every test grouped by type (unit / integration / e2e / security / performance). Each entry: name, file path, intent in one line.
- **Mock policy audit** — every mock in the proposed or existing tests. For each: target, justification, verdict (✓ acceptable · ✗ violates project rule).
- **Determinism review** — patterns that cause flakes: clock dependence (`Date.now`, `new Date()`), network calls without mocks, random data without seed, order-dependent tests. List each instance + fix.
- **Security tests** — for every Security item in the spec, the test that exercises it (auth bypass, input fuzzing, injection attempt, rate-limit verification).
- **Performance tests** — only when applicable (rate limits, batch operations, queue depth, large data). One test per perf-sensitive spec item.
- **Gaps & risks** — ranked. What's NOT covered and what that means.
- **Recommendations** — concrete test files/cases to add, with file paths and one-line intents.

## Question scope

**Allowed** (test-design ambiguities):

- "Is the 100/min rate limit a unit-test concern or a load-test concern?"
- "Should webhook signature verification have unit tests, integration tests, or both?"
- "Test the worker via `worker.process(job)` directly, or by enqueueing and waiting?"
- "Is this third-party API behind a fixture, or a real-but-rate-limited integration?"

**Not allowed** (out of scope):

- Whether the feature itself is needed (brainstorming's job).
- Whether the impl plan's step ordering is right (impl-plan-writing's job).
- Whether to use a different test framework.
- Whether the spec AC is correct.

Tempted to ask a not-allowed question? Add an observation in **Gaps & risks**: "AC3 is hard to test as written — consider tightening to X in a future spec revision."

## Anti-patterns

| Don't | Do |
|---|---|
| Allow a mock around the project's Postgres or Redis | Mark it ✗ in mock policy audit and recommend rewrite as a real-DB integration test. Project rule. |
| Mark a test "covered" without checking the assertion | Read the test. A test that calls a function but asserts nothing meaningful is a gap, not coverage. |
| Suggest 100% coverage as the target | Risk-based coverage. Hot paths and security items need rigor; trivial getters don't. |
| Add unit tests for code that's only meaningfully testable as integration | Match the test type to what's being verified. |
| Test names that describe implementation | "calls hasAccess()" → "rejects unowned post". Name describes observable behavior. |
| Skip the determinism review because tests "look fine" | Flakes hide here. Always scan for `Date.now`, network calls, unseeded randomness, order coupling. |
| Run the project's test command to "verify coverage" | Read-only skill. Tests are run by the engineer during implementation, not during review. |
