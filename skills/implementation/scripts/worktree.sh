#!/usr/bin/env bash
# Worktree helper for the implementation skill.
#
# Layout (under <repo>/.worktrees/<plan>/, gitignored):
#   main/                          consolidated worktree on branch impl/<plan>/main
#                                    every step's diff is applied + committed here
#                                    finalize collapses those commits back to staged
#   step-<N>-<slug>/               per-step worktree on branch impl/<plan>/step-<N>-<slug>
#                                    forked from impl/<plan>/main's current tip
#                                    one parallel subagent works here
#   .base-ref                      commit SHA the run started from; finalize resets to it
#
# At hand-off, the consolidated worktree is the deliverable: the user cd's into
# <repo>/.worktrees/<plan>/main, sees all changes staged, and commits there.
# The user's main checkout stays untouched throughout the run.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
WT_ROOT="${ROOT:+$ROOT/.worktrees}"

require_repo() {
  if [ -z "$ROOT" ]; then
    printf 'not in a git repository · cd to a working tree and retry\n' >&2
    exit 1
  fi
}

usage() {
  cat >&2 <<EOF
worktree.sh <command> [args]

Commands:
  check-env                            Detect the current shell's git environment (repo? worktree? submodule? our own worktree?). Prints key=value pairs on stdout, exit 0 even outside a repo. Run this BEFORE init to decide whether to proceed, cd to the repo root, or ask the user.
  init <plan>                          Create consolidated worktree + branch at <repo>/.worktrees/<plan>/main (impl/<plan>/main). Idempotent — reuses if it already exists. Saves BASE_REF. Ensures .worktrees/ is in .gitignore. Symlinks top-level gitignored entries (.env, node_modules, etc.) from the main checkout. Prints consolidated path on stdout.
  setup <plan> <num> <slug>            Fork a step worktree from impl/<plan>/main's current tip; symlinks top-level gitignored entries from the main checkout; prints the step worktree path on stdout.
  apply <plan> <num> <slug>            Capture the step worktree's diff and apply + commit it into the consolidated worktree as "step <N>: <slug>". No-op if the step produced no diff.
  cleanup <plan> <num> <slug>          Remove one step worktree + its branch. Keeps the consolidated.
  cleanup-steps <plan>                 Remove every step worktree + step branch. Keeps the consolidated.
  finalize <plan>                      Inside the consolidated worktree, git reset --soft to BASE_REF so the per-step commits collapse back to a single staged diff. Prints the consolidated path on stdout.
  teardown <plan>                      Full cleanup: every per-step worktree, the consolidated worktree, every impl/<plan>/* branch, and .worktrees/<plan>/.
  link-ignored <dst>                   Symlink top-level gitignored entries from the main checkout into <dst>. Idempotent. Useful for refreshing a worktree after the main checkout adds a new ignored entry.

Environment:
  WORKTREE_NO_SYMLINK=1                Disable auto-symlinking of gitignored entries during init/setup. Symlinks can still be added later with `link-ignored <dst>`.

Naming:
  consolidated path:   <repo>/.worktrees/<plan>/main             branch: impl/<plan>/main
  step worktree path:  <repo>/.worktrees/<plan>/step-<N>-<slug>  branch: impl/<plan>/step-<N>-<slug>
EOF
  exit 1
}

consolidated_path() { printf '%s/%s/main' "$WT_ROOT" "$1"; }
consolidated_branch() { printf 'impl/%s/main' "$1"; }
step_path() { printf '%s/%s/step-%s-%s' "$WT_ROOT" "$1" "$2" "$3"; }
step_branch() { printf 'impl/%s/step-%s-%s' "$1" "$2" "$3"; }
base_ref_file() { printf '%s/%s/.base-ref' "$WT_ROOT" "$1"; }

ensure_gitignore() {
  local gi="$ROOT/.gitignore"
  if [ -f "$gi" ]; then
    if ! awk 'BEGIN{f=0} $0=="\\.worktrees/" || $0==".worktrees/" {f=1} END{exit f?0:1}' "$gi" 2>/dev/null; then
      printf '\n.worktrees/\n' >> "$gi"
    fi
  else
    printf '.worktrees/\n' > "$gi"
  fi
}

# Path to the main (non-worktree) checkout, regardless of which worktree we're called from.
main_repo_path() {
  local common
  common="$(git rev-parse --git-common-dir 2>/dev/null)" || { printf '%s' "$ROOT"; return; }
  case "$common" in
    /*) ;;
    *) common="$ROOT/$common" ;;
  esac
  common="$(cd "$common" 2>/dev/null && pwd -P || echo "$common")"
  case "$common" in
    */.git) printf '%s' "${common%/.git}" ;;
    *) printf '%s' "$ROOT" ;;
  esac
}

# Symlink every top-level gitignored entry from $src into $dst.
# Idempotent — skips entries that already exist in the destination.
# Top-level only (no nested paths) to keep behavior predictable.
# Opt out by setting WORKTREE_NO_SYMLINK=1.
link_ignored() {
  local src="$1" dst="$2"
  [ -d "$src" ] || { printf 'link-ignored: source %s missing\n' "$src" >&2; return 1; }
  [ -d "$dst" ] || { printf 'link-ignored: target %s missing\n' "$dst" >&2; return 1; }
  if [ "${WORKTREE_NO_SYMLINK:-}" = "1" ]; then
    printf 'link-ignored: WORKTREE_NO_SYMLINK=1 · skipping\n' >&2
    return 0
  fi
  local count=0 entry
  while IFS= read -r entry; do
    entry="${entry%/}"
    case "$entry" in
      ""|.worktrees|.git) continue ;;
      */*) continue ;; # top-level only
    esac
    [ -e "$src/$entry" ] || [ -L "$src/$entry" ] || continue
    if [ -e "$dst/$entry" ] || [ -L "$dst/$entry" ]; then continue; fi
    ln -s "$src/$entry" "$dst/$entry"
    count=$((count + 1))
  done < <(git -C "$src" ls-files --others --ignored --exclude-standard --directory --no-empty-directory 2>/dev/null || true)
  printf 'link-ignored: %d entries linked from %s into %s\n' "$count" "$src" "$dst" >&2
}

cmd="${1:-}"
shift || true

case "$cmd" in
  check-env)
    topl="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    gitdir="$(git rev-parse --git-dir 2>/dev/null || true)"
    gitcommon="$(git rev-parse --git-common-dir 2>/dev/null || true)"
    superproj="$(git rev-parse --show-superproject-working-tree 2>/dev/null || true)"
    [ -n "$gitdir" ] && gitdir="$(cd "$gitdir" 2>/dev/null && pwd -P || echo "$gitdir")"
    [ -n "$gitcommon" ] && gitcommon="$(cd "$gitcommon" 2>/dev/null && pwd -P || echo "$gitcommon")"
    in_repo=false; [ -n "$topl" ] && in_repo=true
    in_submodule=false; [ -n "$superproj" ] && in_submodule=true
    in_worktree=false
    if [ "$in_repo" = true ] && [ -n "$gitdir" ] && [ -n "$gitcommon" ] && [ "$gitdir" != "$gitcommon" ] && [ "$in_submodule" = false ]; then
      in_worktree=true
    fi
    in_our_worktree=false
    if [ "$in_worktree" = true ]; then
      case "$topl" in
        */.worktrees/*) in_our_worktree=true ;;
      esac
    fi
    if [ "$in_repo" = false ]; then
      recommended="not-a-repo"
    elif [ "$in_our_worktree" = true ]; then
      recommended="cd-to-repo-root"
    elif [ "$in_worktree" = true ]; then
      recommended="ask-user"
    else
      recommended="proceed"
    fi
    printf 'repo_root=%s\n' "$topl"
    printf 'git_dir=%s\n' "$gitdir"
    printf 'git_common=%s\n' "$gitcommon"
    printf 'superproject=%s\n' "$superproj"
    printf 'in_repo=%s\n' "$in_repo"
    printf 'in_worktree=%s\n' "$in_worktree"
    printf 'in_submodule=%s\n' "$in_submodule"
    printf 'in_our_worktree=%s\n' "$in_our_worktree"
    printf 'recommended=%s\n' "$recommended"
    ;;

  init)
    require_repo
    plan="${1:?plan required}"
    mkdir -p "$WT_ROOT/$plan"
    cpath="$(consolidated_path "$plan")"
    cbranch="$(consolidated_branch "$plan")"
    bref="$(base_ref_file "$plan")"
    if [ -d "$cpath" ]; then
      printf 'consolidated worktree already exists at %s · reusing\n' "$cpath" >&2
    else
      base="$(git rev-parse HEAD)"
      git worktree add -b "$cbranch" "$cpath" "$base" >&2
      printf '%s\n' "$base" > "$bref"
    fi
    ensure_gitignore
    link_ignored "$(main_repo_path)" "$cpath"
    printf '%s\n' "$cpath"
    ;;

  setup)
    require_repo
    plan="${1:?plan required}"; num="${2:?step-num required}"; slug="${3:?step-slug required}"
    cpath="$(consolidated_path "$plan")"
    [ -d "$cpath" ] || { printf 'consolidated worktree missing at %s · run init first\n' "$cpath" >&2; exit 1; }
    spath="$(step_path "$plan" "$num" "$slug")"
    sbranch="$(step_branch "$plan" "$num" "$slug")"
    forkpoint="$(git -C "$cpath" rev-parse HEAD)"
    git worktree add -b "$sbranch" "$spath" "$forkpoint" >&2
    link_ignored "$(main_repo_path)" "$spath"
    printf '%s\n' "$spath"
    ;;

  apply)
    require_repo
    plan="${1:?plan required}"; num="${2:?step-num required}"; slug="${3:?step-slug required}"
    cpath="$(consolidated_path "$plan")"
    spath="$(step_path "$plan" "$num" "$slug")"
    [ -d "$cpath" ] || { printf 'consolidated worktree missing at %s · cannot apply\n' "$cpath" >&2; exit 1; }
    [ -d "$spath" ] || { printf 'step worktree missing at %s · cannot apply\n' "$spath" >&2; exit 1; }
    patch="$(mktemp)"
    git -C "$spath" diff HEAD > "$patch"
    if [ -s "$patch" ]; then
      git -C "$cpath" apply --index "$patch"
      git -C "$cpath" commit -m "step $num: $slug" >&2
      printf 'applied step %s (%s) into consolidated\n' "$num" "$slug" >&2
    else
      printf 'step %s (%s) produced no diff · nothing to apply\n' "$num" "$slug" >&2
    fi
    rm -f "$patch"
    ;;

  cleanup)
    require_repo
    plan="${1:?plan required}"; num="${2:?step-num required}"; slug="${3:?step-slug required}"
    spath="$(step_path "$plan" "$num" "$slug")"
    sbranch="$(step_branch "$plan" "$num" "$slug")"
    git worktree remove --force "$spath" 2>/dev/null || true
    git branch -D "$sbranch" 2>/dev/null || true
    ;;

  cleanup-steps)
    require_repo
    plan="${1:?plan required}"
    prefix="$WT_ROOT/$plan/step-"
    git worktree list --porcelain | awk -v p="$prefix" '$1=="worktree" && index($2,p)==1 { print $2 }' | while IFS= read -r p; do
      git worktree remove --force "$p" 2>/dev/null || true
    done
    git for-each-ref --format='%(refname:short)' "refs/heads/impl/$plan/" 2>/dev/null | awk -v keep="impl/$plan/main" '$0!=keep' | while IFS= read -r b; do
      [ -n "$b" ] && git branch -D "$b" 2>/dev/null || true
    done
    ;;

  finalize)
    require_repo
    plan="${1:?plan required}"
    cpath="$(consolidated_path "$plan")"
    bref="$(base_ref_file "$plan")"
    [ -d "$cpath" ] || { printf 'consolidated worktree missing at %s · nothing to finalize\n' "$cpath" >&2; exit 1; }
    [ -f "$bref" ] || { printf 'BASE_REF file missing at %s · cannot determine reset target\n' "$bref" >&2; exit 1; }
    base="$(cat "$bref")"
    git -C "$cpath" reset --soft "$base"
    rm -f "$bref"
    printf 'finalized · consolidated worktree at %s · all changes staged on branch impl/%s/main\n' "$cpath" "$plan" >&2
    printf '%s\n' "$cpath"
    ;;

  link-ignored)
    require_repo
    dst="${1:?destination path required}"
    [ -d "$dst" ] || { printf 'destination %s missing\n' "$dst" >&2; exit 1; }
    link_ignored "$(main_repo_path)" "$dst"
    ;;

  teardown)
    require_repo
    plan="${1:?plan required}"
    prefix="$WT_ROOT/$plan/"
    git worktree list --porcelain | awk -v p="$prefix" '$1=="worktree" && index($2,p)==1 { print $2 }' | while IFS= read -r p; do
      git worktree remove --force "$p" 2>/dev/null || true
    done
    git for-each-ref --format='%(refname:short)' "refs/heads/impl/$plan/" 2>/dev/null | while IFS= read -r b; do
      [ -n "$b" ] && git branch -D "$b" 2>/dev/null || true
    done
    rm -rf "${WT_ROOT:?}/$plan"
    rmdir "$WT_ROOT" 2>/dev/null || true
    ;;

  *)
    usage
    ;;
esac
