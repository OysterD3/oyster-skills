# Subagent prompt template

This is the template the orchestrator fills for each subagent dispatch. Subagents see ONLY this prompt — they have no conversation history, no awareness of other steps, no awareness of the impl plan or test review documents themselves. The prompt must be fully self-contained.

## Filling the template

Replace every `{{PLACEHOLDER}}` with the actual content from the impl plan + test review. Keep section headings exactly as below — the subagent will parse this structure.

## Template

```
You are executing one step of an approved implementation plan. The plan was written and approved by a human; your job is to make exactly the changes this step requires, run the verification, and report back. Do not improvise, expand scope, or commit anything.

# Context
- Repo root: {{REPO_ROOT}}
- Branch you started on: {{BRANCH}}
- You are working in an isolated git worktree at: {{WORKTREE_PATH}} (this is your cwd)
- Project type: {{PROJECT_TYPE}}  (e.g., NestJS + Drizzle + pnpm, or React + Vite + pnpm)

# Step {{STEP_NUMBER}}: {{STEP_TITLE}}

**Goal:** {{STEP_GOAL}}

**Depends on:** {{STEP_DEPENDS_ON}}

## Files to touch (only these)

{{STEP_FILES}}

## Changes

{{STEP_CHANGES}}

## Tests to add or modify

These tests come from the approved test review for this step. Add them to the files indicated; the assertions described are required.

{{STEP_TESTS_FROM_REVIEW}}

## Verification

Run this command exactly. Capture stdout AND stderr. The command must exit 0 for the step to be considered successful.

```bash
{{STEP_VERIFICATION_COMMAND}}
```

# Hard constraints

1. **Do NOT commit.** No `git commit`, no `git commit --amend`, no `git push`. Staging with `git add` is fine if it helps you organize, but never commit.
2. **Do NOT touch files outside the list above.** If you find you need to modify a file not in the "Files to touch" list, STOP and report it as a NOTE — do not silently expand scope. The plan is the contract.
3. **Do NOT run destructive git commands.** No `git reset --hard`, no `git checkout --`, no `git clean -f`. If you need to undo something, do it via normal edits.
4. **Do NOT modify migrations or shared state** unless this step explicitly says so.
5. **Do NOT install new dependencies** unless this step explicitly says so. `pnpm install` to install pre-declared deps is fine.
6. **Do NOT skip the verification command.** Even if you "know" the code works, run it.
7. **Do NOT spawn subagents of your own.** This step is your unit of work. If the work is too large for you, that's a planning bug — report it.
8. **No emojis in code or comments** unless the original file already uses them. The project default is no emojis.

# How to work

1. Read the files listed under "Files to touch" first to understand the current state.
2. Make the minimum changes needed to satisfy "Changes" and "Tests to add or modify".
3. Run the verification command. If it fails, debug only within the listed files. If you can't make it pass without touching files outside the list, STOP and report failure with a NOTE explaining why.
4. When verification passes (or you've decided to stop), report.

# Report format

Your final message back to the orchestrator MUST be in this exact format. The orchestrator parses it:

```
STATUS: success
FILES CHANGED:
- relative/path/to/file1
- relative/path/to/file2
TESTS ADDED:
- relative/path/to/test1.spec.ts
VERIFICATION OUTPUT:
<paste the full command output here, both stdout and stderr>
NOTES:
<one or two short paragraphs on anything surprising, any judgment calls you made, or any concern you want the human reviewer to know about. Empty section means nothing to flag.>
```

If the step failed, use `STATUS: failed` and include in NOTES exactly what went wrong (test that didn't pass, type error, plan ambiguity, etc.).

Begin now.
```

## Placeholder reference

| Placeholder | Where to get it |
|---|---|
| `{{REPO_ROOT}}` | Absolute path to the user's repo root (the cwd of the orchestrator's conversation) |
| `{{BRANCH}}` | Current git branch the user is on |
| `{{WORKTREE_PATH}}` | Returned by the `Agent` tool when using `isolation: "worktree"` — but the agent's cwd is already this, so this can just be "your current working directory" |
| `{{PROJECT_TYPE}}` | Read from the project's package.json + framework cues. Helps the agent reach for the right test command, linter, etc. |
| `{{STEP_NUMBER}}` | From the impl plan |
| `{{STEP_TITLE}}` | From the impl plan |
| `{{STEP_GOAL}}` | From the impl plan |
| `{{STEP_DEPENDS_ON}}` | From the impl plan — list of prior step titles. Note: at execution time these deps are already complete in the main worktree, and the worktree was forked AFTER those changes were applied, so the agent sees them as if they're part of the baseline. |
| `{{STEP_FILES}}` | Impl plan's `Files` field — rendered as a bulleted list of `path — description` |
| `{{STEP_CHANGES}}` | Impl plan's `Changes` field — verbatim |
| `{{STEP_TESTS_FROM_REVIEW}}` | The test review's per-step entries for this step, formatted as: `<test name>` → `<file path>` → `<intent>`. Include the assertion intent so the agent writes meaningful assertions. |
| `{{STEP_VERIFICATION_COMMAND}}` | Impl plan's `Verification` field — verbatim |

## Worktree state before dispatch

CRITICAL for parallel waves: each parallel worktree must be forked from the **current state of the main worktree's working branch**, which includes all changes from all prior waves (already staged in main).

If the agent's worktree forks from a clean commit, it won't see the changes from prior waves that are still staged in main but not committed. Recommended approach: create throwaway WIP commits per wave, then reset to keep changes staged at hand-off.

### Concrete recipe

Run these commands from the orchestrator's `Bash` tool. `BASE_REF` is captured once at the very start of implementation, before wave 0.

**At skill start (before wave 0):**
```bash
BASE_REF=$(git rev-parse HEAD)
echo "$BASE_REF" > /tmp/claude-impl-base-ref
```

**Before dispatching each wave N (where N ≥ 1):**
```bash
# Commit the staged changes from wave N-1 so the new worktrees inherit them
git diff --cached --quiet || git commit -m "WIP: wave $((N-1)) — will be reset at hand-off"
```

(If `git diff --cached --quiet` exits 0, there's nothing staged — skip the commit. Wave 0 always skips this.)

**When dispatching each agent in the wave:** use `isolation: "worktree"` on the `Agent` call. The harness forks the worktree from the current branch tip, so it includes all prior WIP commits.

**After each agent returns successfully:**
```bash
git -C "$AGENT_WORKTREE" diff HEAD > /tmp/wave-${N}-step-${M}.patch
git apply --index /tmp/wave-${N}-step-${M}.patch
rm /tmp/wave-${N}-step-${M}.patch
```

`$AGENT_WORKTREE` is the path returned by the `Agent` tool when `isolation: "worktree"` is used and the agent made changes.

**At skill hand-off (after all waves succeed):**
```bash
BASE_REF=$(cat /tmp/claude-impl-base-ref)
git reset --soft "$BASE_REF"
rm /tmp/claude-impl-base-ref
```

This collapses every WIP commit back to staged-only state. The user sees: clean `git log` (back to `BASE_REF`) and a `git diff --staged` containing all the work from every wave.

**On failure / abort:**
```bash
BASE_REF=$(cat /tmp/claude-impl-base-ref)
git reset --soft "$BASE_REF"
rm /tmp/claude-impl-base-ref
```

Same recipe — collapses the WIP commits whether the run succeeded or failed, leaving partial progress staged for the user to review.

Tell the user once, at the start of implementation: "I'll create temporary `WIP: wave N` commits during execution and collapse them back to staged changes at hand-off. If you see them mid-run in `git log`, that's normal."
