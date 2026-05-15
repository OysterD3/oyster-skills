# Worktrees

The implementation skill executes a multi-step plan across many isolated git worktrees in parallel. This reference covers the environment detection done before any worktree is created, the architecture of the per-plan worktree tree, the script subcommands that manage lifecycle, and the failure modes you'll see.

Approach inspired by [obra/superpowers `using-git-worktrees`](https://github.com/obra/superpowers/blob/main/skills/using-git-worktrees/SKILL.md). The differences: our skill creates a **per-plan tree** of worktrees (one consolidated + N step worktrees), not a single feature worktree, because waves run in parallel.

## Architecture

```
<repo>/
  .worktrees/                                # gitignored (script ensures)
    <plan-slug>/
      main/                                  # consolidated; branch impl/<plan>/main
        ...accumulates every step commit, collapsed at finalize
      step-1-<slug>/                         # branch impl/<plan>/step-1-<slug>
      step-2-<slug>/                         # branch impl/<plan>/step-2-<slug>
      ...
```

- The user's main checkout is **never touched** during the run.
- The **consolidated** worktree collects every step's changes as per-step commits during the run.
- Each parallel subagent gets its **own** step worktree, forked from the consolidated tip at the moment of `setup`.
- At hand-off, `finalize` does `git reset --soft <BASE_REF>` inside the consolidated worktree so all per-step commits collapse back to a single staged diff.

All lifecycle goes through one script: `bash ~/.claude/skills/implementation/scripts/worktree.sh <command>`. Never hand-roll `git worktree` commands inline.

## Gitignored file symlinks

A fresh worktree only contains tracked files — so `.env`, `node_modules`, build caches, and IDE configs are missing. Running `npm install` (or copying credentials) in every worktree would be wasteful, especially for parallel step worktrees.

**`init` and `setup` automatically symlink every top-level gitignored entry from the main checkout** into the new worktree. By default that covers:

- `.env`, `.env.local`, `.env.*` (secrets the worktree needs to run)
- `node_modules/`, `vendor/` (installed deps)
- Build caches: `dist/`, `build/`, `.next/`, `.nuxt/`, `.cache/`, `.parcel-cache/`, `target/`
- IDE configs: `.idea/`, `.vscode/`
- Anything else in the root `.gitignore` that exists in the main checkout

**Scope:** top-level entries only. Nested gitignored paths (e.g. `src/generated/`) aren't symlinked — keeps behavior predictable. If your project needs nested links, add them manually after `setup`.

**Idempotent:** if an entry already exists in the target (real file or existing symlink), it's left alone. Re-running `init` on an existing consolidated worktree reports `0 entries linked` and exits clean.

**Opt out:** `WORKTREE_NO_SYMLINK=1 bash worktree.sh init <plan>` skips the symlinking step. Useful if a branch needs a fundamentally different `node_modules` (e.g., the dep upgrade IS the change). After init, you can `npm install` in the worktree to install fresh.

**Manual refresh:** `bash worktree.sh link-ignored <dst>` re-runs the symlink pass on an existing worktree — handy if the main checkout adds a new ignored entry after the worktree was created.

**Caveat — shared state:** symlinks mean a write inside the worktree (e.g., `npm install <new-pkg>` mutating `node_modules`) reaches back into the main checkout. For most cases that's the right trade-off (saves the install cost). If isolation matters for a particular step, use the opt-out env var and install fresh.

## Step 0 — Detect the environment before any worktree creation

Run `worktree.sh check-env` before calling `init`. It does the `git rev-parse` checks (including the submodule false-positive guard) and prints structured key=value output. Parse the `recommended=` line:

```bash
bash ~/.claude/skills/implementation/scripts/worktree.sh check-env
```

Sample output:

```
repo_root=/Users/x/projects/foo
git_dir=/Users/x/projects/foo/.git
git_common=/Users/x/projects/foo/.git
superproject=
in_repo=true
in_worktree=false
in_submodule=false
in_our_worktree=false
recommended=proceed
```

| `recommended=` | Action |
|---|---|
| `proceed` | Normal repo. Proceed to `init`. |
| `not-a-repo` | Stop. Ask the user to run from a git working tree. |
| `cd-to-repo-root` | User is inside one of our `.worktrees/<plan>/...` paths. Tell them to `cd` back to the repo root (use `git_common`'s parent or `repo_root`'s parent) and re-run. |
| `ask-user` | Inside an unrelated worktree (not ours, not a submodule false positive). Ask: (a) `cd` to the common dir and proceed there, or (b) proceed in place and nest. Default recommendation: (a). |

Submodules are handled transparently — `check-env` returns `in_worktree=false`, `recommended=proceed` for them, even though `git_dir != git_common`.

**Native-tool preference.** If the harness exposes a native worktree tool (`EnterWorktree`, `WorktreeCreate`, a `/worktree` slash command, or an `isolation: "worktree"` parameter on `Agent`), DO NOT use it for *this* skill — we deliberately own the worktree tree so the consolidated/step layout is predictable for the user. Specifically: do **not** pass `isolation: "worktree"` to `Agent`. The script's paths are inspectable; harness-managed worktrees are not.

Native tools are appropriate for skills doing single-feature isolation, not for orchestrating a multi-worktree DAG run.

## Naming conventions

The script enforces these:

- `<plan-slug>` — the impl plan's MD filename slug (`auth-refresh-hardening`).
- `<slug>` — a 2–4 word kebab-case summary of the step (`add-migration`).
- Consolidated branch: `impl/<plan>/main`.
- Step branches: `impl/<plan>/step-<N>-<slug>`.

## Subcommands

Full reference lives in the script's `usage`. Quick map:

| Command | When | Effect |
|---|---|---|
| `check-env` | Before `init` | Reports `repo_root`, `in_worktree`, `in_submodule`, `in_our_worktree`, `recommended=…`. Safe to run from anywhere (exit 0 even outside a repo). |
| `init <plan>` | Once, after `check-env` says `proceed`, after pre-flight passes, before wave 0 | Creates the consolidated worktree + branch, saves `BASE_REF`, ensures `.worktrees/` is in `.gitignore`, **symlinks gitignored entries from the main checkout**. Idempotent. Prints the consolidated path on stdout. |
| `setup <plan> <num> <slug>` | Per step, just before its `Agent` dispatch | Forks a step worktree + branch from the consolidated tip, **symlinks gitignored entries from the main checkout**. Prints the path on stdout — capture for `{{WORKTREE_PATH}}`. |
| `link-ignored <dst>` | Manually, to refresh symlinks after the main checkout grows a new ignored entry | Symlinks top-level gitignored entries from the main checkout into `<dst>`. Idempotent. |
| `apply <plan> <num> <slug>` | After an agent reports `STATUS: success` | Captures the step worktree's diff and applies + commits it into the consolidated as `step <N>: <slug>`. No-op if the step produced no diff. |
| `cleanup <plan> <num> <slug>` | After `apply` succeeds | Removes one step worktree + its branch. The consolidated stays. |
| `cleanup-steps <plan>` | Before `finalize` at hand-off | Sweeps any leftover step worktrees + branches. The consolidated stays. |
| `finalize <plan>` | At hand-off, after `cleanup-steps` | Inside the consolidated worktree, `git reset --soft <BASE_REF>` to collapse every `step N: …` commit back to a single staged diff. Prints the consolidated path. |
| `teardown <plan>` | When the user is done with the consolidated worktree (after they've merged) | Full nuke: removes the consolidated worktree + every `impl/<plan>/*` branch + the `.worktrees/<plan>/` directory. |

## Failure modes

| Failure | Cause | Response |
|---|---|---|
| `init` fails with permission error | Sandbox blocked `git worktree add` (containerized harness, read-only mount) | Surface the error. Offer to (a) run with the sandbox relaxed if the user can, or (b) execute serially in the main checkout — explain the trade-off (no parallelism, every step commits into the user's working tree). Default to surfacing + asking. |
| `init` fails with "already exists" | Stale state from a previous interrupted run | Either reuse it (idempotent — check `BASE_REF` matches the user's expected baseline) or `teardown` and re-init. Ask the user. |
| `setup` fails with "branch already exists" | Same step was set up earlier in this run, or a previous run left state | `cleanup` the step first, then retry `setup`. |
| `apply` exits non-zero | Conflict between step diff and consolidated tip | Stop. Surface the conflict. Don't `--reject` or force. Ask the user how to proceed (manual fix in the step worktree, or skip the step). |
| `finalize` shows nothing staged | All step commits were no-ops (agents reported success but produced no diff) | Surface. Likely a planning bug — the user should investigate before declaring "done". |

## Quick reference

| Situation | Action |
|---|---|
| Already inside one of our `.worktrees/<plan>/` paths | `cd` back to repo root and re-run |
| Inside an unrelated worktree | Ask user: `cd` to common dir, or nest? Default: `cd` |
| Inside a submodule | Proceed as normal repo |
| Native `EnterWorktree` / `isolation: "worktree"` available | Don't use it for this skill — we own the worktree tree |
| `.worktrees/` not in `.gitignore` | `init` adds it; no action needed |
| Permission error on `git worktree add` | Surface to user; offer serial fallback |
| Step diff conflicts on `apply` | Stop, surface, ask — never force |
| Stale step worktree from interrupted run | `cleanup` then retry `setup` |
| User wants to keep the consolidated after the run | Skip `teardown`; tell them they can run it later |
| Worktree needs a different `node_modules` than main | `WORKTREE_NO_SYMLINK=1 bash worktree.sh init <plan>` then `npm install` in the worktree |
| Main checkout grew a new `.gitignore` entry mid-run | `bash worktree.sh link-ignored <worktree-path>` to refresh the symlinks |

## Common mistakes

### Hand-rolling `git worktree`
- **Problem:** Inline `git worktree add` calls skip the script's branch-naming, `BASE_REF` tracking, and `.gitignore` management.
- **Fix:** Always use `worktree.sh <command>`. If a needed operation isn't a subcommand, add it to the script — don't bypass.

### Skipping Step 0 detection
- **Problem:** Creates nested worktrees inside an existing one (recursive `.worktrees/`).
- **Fix:** Run the GIT_DIR/GIT_COMMON check before `init`.

### Treating a submodule as a worktree
- **Problem:** `GIT_DIR != GIT_COMMON` is also true inside submodules — looks like a worktree, isn't.
- **Fix:** Also check `git rev-parse --show-superproject-working-tree`. Non-empty → submodule, proceed as normal repo.

### Passing `isolation: "worktree"` to `Agent`
- **Problem:** The harness creates its own worktree the script doesn't know about. The agent's edits land somewhere unpredictable.
- **Fix:** Always `setup` the worktree yourself and pass the path via `{{WORKTREE_PATH}}` in the agent prompt.

### Forcing `apply` with `--reject`
- **Problem:** Hides what didn't merge. The consolidated ends up in an inconsistent state.
- **Fix:** On conflict, stop and surface. Let the user decide (manual fix, skip the step, abort).

### Forgetting `cleanup-steps` before `finalize`
- **Problem:** Leftover step worktrees clutter `.worktrees/` and confuse the next run.
- **Fix:** Always `cleanup-steps <plan>` immediately before `finalize <plan>` at hand-off.

### Tearing down before the user merges
- **Problem:** `teardown` nukes the consolidated worktree and the branch. If the user hasn't merged yet, their work is gone.
- **Fix:** Only `teardown` when the user explicitly says they're done with the consolidated.

## Telling the user once

At the start of the run, surface this in chat:

> Implementation work happens in a dedicated worktree at `.worktrees/<plan>/main` so your main checkout stays clean. You'll see per-step commits there during the run; at hand-off I'll collapse them back to a single staged diff for you to review and commit. `.worktrees/` is auto-added to `.gitignore`.

Once is enough. Don't repeat per wave.
