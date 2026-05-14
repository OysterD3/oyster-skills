---
name: implementation
description: Execute an approved impl plan via parallel general-purpose subagents in isolated git worktrees, with per-wave user gates. Trigger AFTER impl-plan + test-review approval on "let's implement", "build it", "execute the plan", "start coding". Steps run in DAG waves; orchestrator applies each agent's diff as staged changes (never commits) and pauses for review between waves.
---

# Implementation

The chain's terminal skill. Take an approved impl plan + test review and execute it by orchestrating parallel general-purpose subagents in isolated git worktrees, with a per-wave human checkpoint.

## Operating rules

1. **Approved inputs only.** Require an approved impl plan MD and (ideally) an approved test review MD. If either is missing, ask the user before proceeding.
2. **Wave-by-wave execution.** Steps run in topological waves derived from the impl plan's DAG. Independent steps within a wave run in parallel as subagents.
3. **Consolidated + per-step worktree layout.** All implementation work lives under `<repo>/.worktrees/<plan>/` (gitignored). A long-lived **consolidated** worktree at `.worktrees/<plan>/main` (branch `impl/<plan>/main`) is where every step's changes accumulate. Each parallel subagent gets its own **step** worktree at `.worktrees/<plan>/step-<N>-<slug>` (branch `impl/<plan>/step-<N>-<slug>`), forked from the consolidated worktree's current tip. The user's main checkout is never touched during the run. All worktree lifecycle is delegated to [scripts/worktree.sh](#worktree-management) — do not hand-roll `git worktree` commands inline.
4. **Per-wave approval gate.** After each wave completes (verifications pass, diffs applied), surface a diff summary and pause. Wait for user to say go before the next wave.
5. **Stage, don't commit (visibly).** Each step apply does create one intermediate commit `step <N>: <slug>` inside the consolidated worktree so later waves can fork from prior waves' results. At hand-off, `worktree.sh finalize` does `git reset --soft <BASE_REF>` on the consolidated worktree so those per-step commits collapse back to a single staged diff. The user sees one clean diff and commits at their own pace.
6. **Stop on first failure.** If any subagent's verification fails or any diff fails to apply, halt the wave, surface the failure, ask the user how to proceed. Do NOT silently retry or "fix" — that hides problems.
7. **Concurrency cap of 3 by default.** More overwhelms the system and hurts review quality. User can override per-invocation.
8. **No re-design.** This skill executes the plan as written. If a step is wrong, stop and surface — don't quietly "improve" it.

## Workflow checklist

Drive with TodoWrite — one todo per item.

- [ ] **Locate inputs.** Find the latest MD in `<cwd>/docs/impl-plans/` and the latest matching MD in `<cwd>/docs/test-reviews/` (same slug if possible). Confirm both with the user.
- [ ] **Parse the impl plan.** Extract every step's: number, title, goal, depends-on, files, changes, tests, verification command, rollback.
- [ ] **Parse the test review.** Map each impl-plan step to its expanded per-step test entries — these go into the subagent prompt.
- [ ] **Compute waves.** Build the DAG; group into topological waves. Display the wave plan to the user as a Mermaid `flowchart TD` in chat so they see what's parallel.
- [ ] **Run pre-flight checks** from the impl plan (branch state, env vars, dependencies installed, feature flag created). Block on any failure.
- [ ] **Initialize the consolidated worktree.** Run `bash ~/.claude/skills/implementation/scripts/worktree.sh init <plan-slug>` — creates `<repo>/.worktrees/<plan>/main` on branch `impl/<plan>/main`, saves `BASE_REF`, ensures `.worktrees/` is in `.gitignore`. The script prints the consolidated path on stdout — remember it; you'll point the user there at hand-off. See [Worktree management](#worktree-management).
- [ ] **For each wave** (see [Wave execution](#wave-execution)):
  - Create a step worktree per step (`worktree.sh setup <plan> <num> <slug>` — forks from the consolidated tip). Dispatch parallel subagents (max 3 concurrent — see [Concurrency](#concurrency)).
  - Collect results.
  - On any failure, halt and surface.
  - For each successful step, apply the diff (`worktree.sh apply <plan> <num> <slug>` — commits `step <N>: <slug>` into the consolidated worktree), then clean the step worktree (`worktree.sh cleanup <plan> <num> <slug>`).
  - Surface per-step diff summary.
  - Pause for user approval.
- [ ] **Run post-flight checks** from the impl plan (full test suite, lint, type-check, manual smoke for UI changes per project CLAUDE.md) **inside the consolidated worktree**.
- [ ] **Finalize and hand off.** Run `worktree.sh cleanup-steps <plan-slug>` (removes any leftover step worktrees), then `worktree.sh finalize <plan-slug>` (collapses every `step N: …` commit in the consolidated back to a single staged diff). Surface the consolidated worktree path and tell the user: "All changes are staged at `<.worktrees/<plan>/main>` on branch `impl/<plan>/main`. cd there to review, commit, and merge back. Your main checkout was not touched." Mention the next link: the `post-implementation-review` skill runs code review → simplify → security review on the staged diff before commit — offer to invoke it from inside the consolidated worktree ("Want me to run the post-implementation review pipeline now from the consolidated worktree?") and proceed only if they say yes. When the user is fully done with the consolidated worktree (after merging), they can run `worktree.sh teardown <plan-slug>` to drop the worktree + branch + `.worktrees/<plan>/` directory.

## Wave execution

### Computing waves

Standard Kahn's algorithm:

1. Take all steps from the impl plan.
2. Wave 0: every step whose `Depends on` is `none` or empty.
3. Remove wave-0 steps from the graph. Wave 1: every remaining step whose dependencies are all in wave 0.
4. Continue until all steps are placed.

A wave can have 1 step (forced serial) or many (parallel up to the concurrency cap).

### Dispatching a wave

For each step in the wave:

1. Run `bash ~/.claude/skills/implementation/scripts/worktree.sh setup <plan-slug> <step-num> <step-slug>` — creates `<repo>/.worktrees/<plan>/step-<N>-<slug>` on branch `impl/<plan>/step-<N>-<slug>`, forked from the consolidated worktree's current tip. The script prints the step worktree path on stdout — capture it as `{{WORKTREE_PATH}}` for the agent prompt.
2. Spawn an `Agent` call with:
   - `subagent_type`: `general-purpose` (only agent with full tool access for edits)
   - `description`: short summary like `"Execute step 3: Add DAL setForwardEnabled"`
   - `prompt`: the full self-contained briefing from [references/agent-prompt-template.md](references/agent-prompt-template.md), with placeholders filled — `{{WORKTREE_PATH}}` is the path from step 1.

Do **not** pass `isolation: "worktree"`. The script owns worktree lifecycle so the worktrees land at predictable paths the user can inspect and `.gitignore` knows about.

Send all Agent tool calls for the wave **in the same message** for parallel dispatch within a wave (up to the concurrency cap). The harness runs them concurrently.

### Collecting results

Each subagent returns a single message. Expected shape per the template's instructions:

```
STATUS: success | failed
FILES CHANGED:
- path/to/file1
- path/to/file2
TESTS ADDED:
- path/to/test1
VERIFICATION OUTPUT:
<paste of command output>
NOTES:
<anything surprising or worth flagging>
```

Parse the status. Any `failed` → halt the wave.

### Merging diffs back

For each successful agent:

1. Apply the step's diff into the consolidated worktree: `bash ~/.claude/skills/implementation/scripts/worktree.sh apply <plan-slug> <step-num> <step-slug>`. The script does `git -C <step-wt> diff HEAD | git -C <consolidated> apply --index` and then commits it as `step <N>: <slug>` so the next wave's step worktrees can fork from a tree that includes this work.
2. Clean up the step worktree + its branch: `bash ~/.claude/skills/implementation/scripts/worktree.sh cleanup <plan-slug> <step-num> <step-slug>`.
3. If `apply` exits non-zero (conflict, malformed patch): stop, surface the conflict, ask the user how to proceed. Do not force.

### Per-wave checkpoint

After all agents in the wave succeed and their diffs are applied:

1. Run `git diff --staged --stat` to show file-level change summary.
2. List each step's: title, files changed, tests added, verification output (one-line summary).
3. Ask the user: "Wave N applied. Review the staged diff. Proceed to wave N+1, or revise?" Wait.

## Worktree management

All worktree lifecycle goes through one script: `scripts/worktree.sh` (ships with this skill). Always invoke it via `bash ~/.claude/skills/implementation/scripts/worktree.sh <command>` so it works regardless of the user's `PATH`.

**Architecture:**
- The user's main checkout is never touched during the run.
- The **consolidated** worktree at `<repo>/.worktrees/<plan>/main` (branch `impl/<plan>/main`) collects every step's changes via per-step commits. At hand-off, `finalize` resets it `--soft` to the saved `BASE_REF` so the user sees a single staged diff.
- Each parallel subagent gets its own **step** worktree at `<repo>/.worktrees/<plan>/step-<N>-<slug>` (branch `impl/<plan>/step-<N>-<slug>`), forked from the consolidated tip at the moment of `setup`.

**Naming conventions** (the script enforces these):
- `<plan-slug>` is the impl plan's MD slug (e.g. `auth-refresh-hardening`).
- `<slug>` is a 2–4 word kebab-case summary of the step (e.g. `add-migration`).

**Subcommands** (full reference in the script's `usage`):

| Command | When to run | What it does |
|---|---|---|
| `init <plan>` | Once, after pre-flight passes, before wave 0 | Creates the consolidated worktree + branch, saves `BASE_REF`, ensures `.worktrees/` is in `.gitignore`. Idempotent. Prints the consolidated path on stdout. |
| `setup <plan> <num> <slug>` | Per step, just before its `Agent` dispatch | Forks a step worktree + branch from the consolidated tip. Prints the path on stdout — capture it for `{{WORKTREE_PATH}}`. |
| `apply <plan> <num> <slug>` | After an agent reports `STATUS: success` | Captures the step worktree's diff and applies + commits it into the consolidated as `step <N>: <slug>`. No-op if the step produced no diff. |
| `cleanup <plan> <num> <slug>` | After `apply` succeeds | Removes one step worktree + its branch. The consolidated stays. |
| `cleanup-steps <plan>` | Before `finalize` at hand-off | Sweeps any leftover step worktrees + branches. The consolidated stays. |
| `finalize <plan>` | At hand-off, after `cleanup-steps` | Inside the consolidated worktree, `git reset --soft <BASE_REF>` to collapse every `step N: …` commit back to a single staged diff. Prints the consolidated path on stdout. |
| `teardown <plan>` | When the user is done with the consolidated worktree (after they've merged) | Full nuke: removes the consolidated worktree + every `impl/<plan>/*` branch + the `.worktrees/<plan>/` directory. |

**Tell the user once, at the start of the run:** "Implementation work happens in a dedicated worktree at `.worktrees/<plan>/main` so your main checkout stays clean. You'll see per-step commits there during the run; at hand-off I'll collapse them back to a single staged diff for you to review and commit. `.worktrees/` is auto-added to `.gitignore`."

## Concurrency

- Default cap: **3** parallel subagents per wave.
- If a wave has more than 3 independent steps, split into sub-batches of 3. Run sub-batch 1, then sub-batch 2 (still within the same wave gate — only checkpoint after the whole wave finishes).
- User can override per invocation: "run wave 2 serially" or "bump concurrency to 5". Honor the request.

## Failure handling

When a subagent reports `STATUS: failed`:

1. **Stop the wave immediately.** Do not dispatch the next wave. Other agents currently running in the same wave finish on their own; collect their results too.
2. **Surface the failure.** In chat, show: step number, title, verification output that failed, anything in the agent's NOTES.
3. **Apply successful sibling diffs?** Ask the user. Options:
   - Yes — apply the agents that succeeded so partial progress isn't lost
   - No — discard everything from this wave; the failed step poisons the wave
4. **Ask the user how to proceed.** Options:
   - Manual fix (user edits the failing step, then says go to retry just that step)
   - Delegate diagnosis to `codex:rescue` subagent for a deeper look
   - **Skip this step and continue the wave** — only when the failure is in an optional/deferrable step. Note the skipped step in the per-wave summary and add it to a `Deferred steps` list surfaced at hand-off. Reject this option for steps any downstream step depends on (would orphan its dependents).
   - Revise the impl plan (back up to impl-plan-writing)
   - Abort

Never silently retry. Never quietly tweak the plan. Always surface and ask.

## What goes in the subagent prompt

The subagent has NO conversation history. The prompt must be fully self-contained. Use [references/agent-prompt-template.md](references/agent-prompt-template.md) as the source of truth. It includes:

- Repo root path
- Step number, title, goal
- Files to touch (paths + per-file change description)
- Specific changes (verbatim from impl plan)
- Tests to add (names + intent from test review, with file paths)
- Verification command
- **Constraint: do not commit. Stage with `git add` if helpful, but never `git commit`. Run the verification command. Report results in the structured format.**
- **Constraint: only touch files listed for this step. If you need to touch others, stop and report — don't expand scope.**
- **Constraint: no destructive Bash. No `git reset --hard`, `git checkout --`, etc.**

## What does NOT use a subagent

Some steps can't safely be dispatched to a parallel agent. Run these in the orchestrator's own context, sequentially:

- **DB migrations** — running `pnpm db:migrate` in a parallel worktree against the project's dev DB would race. Either: (a) the user runs migrations manually before the wave that needs them, (b) the orchestrator runs them inline before dispatching dependent agents.
- **Steps marked as manual** in the impl plan (e.g. "create the Stripe webhook in their dashboard").
- **Final post-flight checks** — orchestrator runs these directly in the main worktree.

When a step is non-subagent-safe, the impl plan's per-step entry should flag it; if not, the orchestrator decides and tells the user.

## Anti-patterns

| Don't | Do |
|---|---|
| Spawn 10 agents to "save time" | Cap at 3. Quality of merge review degrades fast above that. |
| Skip the per-wave gate | The gate is the whole point. Surfacing diffs incrementally is what makes this safer than autonomous execution. |
| Auto-commit "for traceability" | Stage only. User commits. Project CLAUDE.md is explicit on this. |
| Apply a failed patch with `--reject` | Surface the conflict. Forced apply hides what didn't merge. |
| Silently widen a step's scope when an agent says "I also need to touch X" | Halt the step. Either the plan is wrong (escalate) or the agent overreached (re-prompt narrowly). |
| Reuse the same worktree for parallel agents | Defeats isolation. Each parallel agent gets its own. |
| Continue past a verification failure to "see what else breaks" | Stop. Failures compound. |
| Edit code yourself in the main worktree during execution | Only subagents edit. Orchestrator only reads, dispatches, applies patches, and reports. |
