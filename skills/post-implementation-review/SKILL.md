---
name: post-implementation-review
description: Three-phase post-build review of staged or branch-relative diff. Phase 1 dispatches the feature-dev code-reviewer agent for bugs/quality. Phase 2 invokes the simplify skill. Phase 3 invokes the security-review skill. User gate between phases. Trigger AFTER implementation on "review the code", "do code review", "final review before commit". Never auto-commits.
---

# Post-implementation review

The chain's quality gate after code is written. Three sequential phases on the working diff; each reuses an existing skill or agent — this skill orchestrates, it doesn't reimplement.

## TL;DR

- **Three phases in order:** code review → simplify → security review.
- **User gate between each phase.** Apply findings before the next phase runs.
- **Delegate everything:** `feature-dev:code-reviewer`, then `simplify`, then `security-review`. No reimplementation.
- **Never commits.** Changes stay staged.
- **Stoppable:** "skip simplify" / "stop after code review" is fine.

## Operating rules

1. **Three phases, in order, with gates between.** Code review → Simplify → Security review. Each phase finishes and the user decides whether to act on findings before the next phase runs. Order is intentional: simplify shouldn't run on code with known bugs; security should run on the cleaned-up final form.
2. **Delegate, don't reimplement.** Phase 1 uses the `feature-dev:code-reviewer` agent. Phase 2 invokes the `simplify` skill. Phase 3 invokes the `security-review` skill. The orchestrator's job is scoping, sequencing, and surfacing — not duplicating their logic.
3. **Surface every finding.** Don't filter the sub-skills' output. They have their own confidence/severity filtering already.
4. **No commits.** Changes stay staged. The user commits when they're ready, after the pipeline ends.
5. **Stop on user request.** "Stop after code review" or "skip simplify" is fine — surface findings from the phases that ran and end.
6. **Honor existing files.** Don't re-introduce code the user explicitly deleted or simplified out. If a phase suggests something that was previously rejected, note it gently and move on.

## Workflow checklist

Drive with TodoWrite — one todo per phase.

- [ ] **Locate the change scope.** In order of preference:
   1. Staged diff if present (`git diff --staged`)
   2. If nothing is staged: the diff against the branch's merge-base with main (`git diff $(git merge-base HEAD main)`)
   3. Ask the user if neither yields a meaningful diff
- [ ] **Confirm scope with the user** in one sentence: "Reviewing N files / M lines staged. Right scope?" Wait for go.
- [ ] **Phase 1 — Code review.** Dispatch the `feature-dev:code-reviewer` subagent (see [Phase 1 dispatch](#phase-1--code-review-dispatch)). Surface its report. Pause for user to apply / skip findings.
- [ ] **Phase 2 — Simplify.** Invoke the `simplify` skill via the `Skill` tool. Surface its findings and proposed changes. Pause for user.
- [ ] **Phase 3 — Security review.** Invoke the `security-review` skill via the `Skill` tool. Surface its report. Pause for user.
- [ ] **Final summary.** In chat, list: per-phase issue counts, what was applied vs deferred, what remains. Tell the user: "Pipeline complete. Changes still staged — commit when ready."

## Phase 1 — Code review (dispatch)

Dispatch a single `Agent` call with `subagent_type: "feature-dev:code-reviewer"`. The agent is research-only (its tool list excludes Edit/Write), so it will report issues — not fix them.

Use the prompt from [references/code-reviewer-prompt.md](references/code-reviewer-prompt.md), filling these placeholders:

| Placeholder | Source |
|---|---|
| `{{REPO_ROOT}}` | The current working directory |
| `{{DIFF_SCOPE}}` | "Staged diff" or "Branch-relative diff (vs main)" — whichever was confirmed in step 2 |
| `{{DIFF_SUMMARY}}` | `git diff --staged --stat` output (or branch-relative variant) |
| `{{PROJECT_CONVENTIONS_PATH}}` | `<cwd>/CLAUDE.md` if exists (the agent reads it for convention rules) |
| `{{LINKED_SPEC}}` | Latest spec MD in `<cwd>/docs/specs/`, if relevant. Helps the reviewer judge whether code matches the contract. |
| `{{LINKED_IMPL_PLAN}}` | Latest impl plan MD in `<cwd>/docs/impl-plans/`, if relevant. |

After the agent returns, surface its report verbatim in chat with a small wrapper:

```
## Phase 1 — Code review

<paste agent output>

---
**Apply, defer, or skip?** Tell me which findings to address (e.g. "fix #1 and #3, skip the rest") and I'll either make the edits or wait while you do.
```

If the user asks the orchestrator to apply fixes, do so with `Edit` directly — these are surgical changes, not full subagent dispatches.

## Phase 2 — Simplify

The `simplify` skill is plugin-provided and may not be installed everywhere. Before invoking, check that it appears in the available-skills list for this session. If absent, tell the user:

> Phase 2 (simplify) skipped — the `simplify` skill isn't installed in this environment. To enable it: install the relevant plugin, or run a manual "look for reuse opportunities, dead code, over-engineering" pass yourself.

Then jump to Phase 3.

If present, invoke via:

```
Skill({ skill: "simplify" })
```

The `simplify` skill operates on changed code, finds reuse opportunities and over-engineering, and proposes fixes (or applies them — its own behavior). Surface whatever it returns in a Phase 2 wrapper:

```
## Phase 2 — Simplify

<simplify output>

---
**Continue to security review, or pause to review the simplify changes first?**
```

If `simplify` already applied changes, surface `git diff --staged --stat` to show what changed.

## Phase 3 — Security review

The `security-review` skill is plugin-provided. If absent from the available-skills list, tell the user:

> Phase 3 (security review) skipped — the `security-review` skill isn't installed. Strongly recommend running a manual security pass yourself: authn/authz, input validation, secrets handling, injection vectors, rate limiting. Or install the relevant plugin.

If present, invoke via:

```
Skill({ skill: "security-review" })
```

The `security-review` skill runs a structured security pass on pending changes. Surface its output:

```
## Phase 3 — Security review

<security-review output>

---
**Apply findings, defer to a follow-up, or mark as final?**
```

For any "high" severity finding, the orchestrator should ask explicitly: "Finding N is marked high — address now, or are you ok deferring? If deferring, I'll add it to the final summary as a deferred risk."

## Final summary

After all three phases:

```
## Post-implementation review summary

| Phase | Issues found | Applied | Deferred |
|---|---|---|---|
| Code review | N | N | N |
| Simplify | N | N | N |
| Security review | N | N | N |

**Deferred items** (carry these into a follow-up PR or the project's tracker):
- <deferred item 1>
- <deferred item 2>

**Status:** Changes are staged. No commits made. Ready for you to commit when you're done.
```

Keep the summary tight — it's a recap, not a re-report.

## Chaining from implementation

The `implementation` skill's hand-off message should mention this pipeline as the next link. If invoked right after implementation:

- The staged diff is fresh — use it as the scope.
- Don't run the pipeline silently; still confirm scope with the user in one sentence. This is the user's first checkpoint after a multi-step build.

## When to skip a phase

- **Skip code review** when the user says "skip code review" or the diff is trivially small (e.g. a one-line config change).
- **Skip simplify** when the diff is mostly deletions or boilerplate that doesn't admit simplification.
- **Never skip security review** unless the user explicitly says so AND the diff genuinely has no security surface (no inputs, no auth, no secrets, no external calls, no data persistence). Even then, run it — `security-review` will quickly report "no security-relevant changes" and that's a valuable signal.

If skipping, note it in the final summary.

## Anti-patterns

| Don't | Do |
|---|---|
| Run all three phases without pausing | Pause after each. The whole point of phasing is incremental application. |
| Filter or rephrase the sub-skills' findings | Surface verbatim. They've already filtered to what they think matters. |
| Auto-apply Phase 1 findings without asking | Code review is report-only. The user decides what to apply. |
| Commit after the pipeline ends | Never. Changes stay staged. The user commits. |
| Run security review first because "security is the highest priority" | Order is code → simplify → security for a reason: security on the final, cleaned-up code is the meaningful pass. |
| Treat phase output as a checklist to mechanically tick | Findings are judgment calls. Surface them; let the user judge. |
| Skip Phase 3 because Phase 1 was "clean" | Code review and security review look at different things. A clean code review does not imply a clean security pass. |
