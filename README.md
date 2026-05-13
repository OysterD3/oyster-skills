# oyster-skills

A chain of [Claude Code skills](https://docs.claude.com/claude-code/skills) for taking a feature from idea to shipped code, with human review gates between each phase.

## The chain

```
brainstorming → spec-writing → impl-plan-writing → test-review → implementation → post-implementation-review
   (HTML)          (HTML→MD)       (HTML→MD)         (HTML→MD)      (staged diff)        (chat)
                       ↑
                  roast-me (optional, opt-in pre-sign-off)
```

Each link reads the prior artifact, asks narrow clarifying questions, runs a self-review, renders an HTML for human review, and writes the canonical Markdown only after explicit user approval.

## The skills

| Skill | Triggers on | Output |
|---|---|---|
| `brainstorming` | "let's plan", "help me plan", "how should we approach" | `docs/brainstorming/<date>-<slug>.html` |
| `roast-me` | "roast me", "be brutal", "tear this apart" | Inline chat — calibrated harshness |
| `spec-writing` | "move on to spec", "write the spec" | `docs/specs/<date>-<slug>.{html,md}` |
| `implementation-plan-writing` | "plan the build", "write the impl plan" | `docs/impl-plans/<date>-<slug>.{html,md}` |
| `test-review` | "review the tests", "audit tests in X" | `docs/test-reviews/<date>-<slug>.{html,md}` |
| `implementation` | "let's implement", "execute the plan" | Staged git diff (never commits) |
| `post-implementation-review` | "review the code", "final review before commit" | Inline chat — code review → simplify → security |

## Install

```bash
git clone https://github.com/OysterD3/oyster-skills.git ~/Projects/oyster-skills
cd ~/Projects/oyster-skills
./install.sh
```

The script symlinks each skill into `~/.claude/skills/`. Re-running is safe — it skips existing symlinks and warns on conflicts.

## How the HTML review system works

Each review skill produces a dark-mode HTML file with inline-comment support. The HTML talks to a tiny **review server** that persists comments to disk so Claude can read them directly.

```bash
node ~/.claude/skills/brainstorming/scripts/review-server.mjs
```

Then open `http://localhost:7681/docs/<area>/<file>.html` in your browser. Select any text → click "💬 Comment" → leave inline feedback. Comments save automatically to `<filename>.comments.json` next to the HTML; when you say "address the comments" in chat, Claude reads them directly.

The server has a 30-minute idle timeout. Each review skill auto-starts it (if not already running) when handing off, and shuts it down at completion. Manual shutdown: `curl -X POST http://localhost:7681/api/shutdown`.

## How implementation parallelizes work

`implementation` parses the impl plan's step dependency DAG, groups steps into **execution waves**, and dispatches each wave's steps to general-purpose subagents in isolated git worktrees (max 3 in parallel). After each wave, the orchestrator applies each agent's diff as staged changes in the main worktree and pauses for you to review before the next wave fires.

Diffs are never committed — that's always your call.

## Conventions

- Each skill produces both an HTML review (for human comments) and a Markdown canonical artifact (engineering source of truth).
- Artifacts land in `<cwd>/docs/<area>/`. Add `docs/` to your `.gitignore` to keep them local.
- Skills don't auto-commit. Ever.
- The skill bodies are kept lean; deeper references live in `skills/<name>/references/`.

## Requirements

- [Claude Code](https://docs.claude.com/claude-code) installed
- Node ≥ 18 (for the review server)
- macOS / Linux (the `install.sh` uses POSIX `ln -s`)

## License

MIT
