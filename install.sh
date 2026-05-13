#!/usr/bin/env bash
# Symlinks each skill in this repo into ~/.claude/skills/
# Safe to re-run: skips already-linked skills, warns on conflicts.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"

if [ ! -d "$HOME/.claude" ]; then
  echo "Error: ~/.claude does not exist. Is Claude Code installed?" >&2
  exit 1
fi

mkdir -p "$SKILLS_DIR"

installed=0
skipped=0
conflicts=0

for src in "$REPO_DIR/plugins/oyster/skills"/*/; do
  name="$(basename "$src")"
  target="$SKILLS_DIR/$name"
  src_clean="${src%/}"

  if [ -L "$target" ]; then
    existing="$(readlink "$target")"
    if [ "$existing" = "$src_clean" ]; then
      echo "  ✓ $name (already symlinked)"
      skipped=$((skipped+1))
      continue
    fi
    echo "  ⚠ $name (symlink exists, points elsewhere: $existing) — skipping"
    conflicts=$((conflicts+1))
    continue
  fi

  if [ -e "$target" ]; then
    echo "  ⚠ $name (directory or file already at $target) — skipping"
    conflicts=$((conflicts+1))
    continue
  fi

  ln -s "$src_clean" "$target"
  echo "  ✓ $name (installed)"
  installed=$((installed+1))
done

echo ""
echo "Done. Installed: $installed · Skipped: $skipped · Conflicts: $conflicts"

if [ "$conflicts" -gt 0 ]; then
  echo ""
  echo "Resolve conflicts manually if you want those skills installed."
  echo "Each conflict is a file/dir/symlink at ~/.claude/skills/<name> that's not our symlink."
  exit 1
fi
