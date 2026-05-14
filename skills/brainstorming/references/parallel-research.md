# Parallel research

Research dominates the brainstorm budget. When axes are independent, fan them out as parallel subagents in a single message — they run concurrently, and Sonnet 4.6 is plenty for read-only investigation (Opus is overkill for fact-finding; save its judgment for synthesis).

## When to spawn vs. do inline

| Situation | Approach |
|---|---|
| "Find X in `<known-dir>`" | inline `Bash`/`Read` — one grep is faster than a subagent spawn |
| "How does the auth middleware work?" (one focused dive) | inline `Read` after a quick `rg` |
| "How do A, B, C currently work?" (3 independent axes) | spawn 3 `Explore` subagents in one message, parallel |
| Unknown file location, broad naming variations | spawn one `Explore` with `breadth: very thorough` |
| "Is library X still maintained, what's the current API, alternatives?" (multi-topic web) | spawn 2–3 `general-purpose` subagents in one message |
| Question B depends on the answer to A | serialize — don't parallelize dependent queries |

## How

Single message, multiple `Agent` tool calls. For each:

- `subagent_type`: `Explore` (code search) or `general-purpose` (web / multi-step)
- `model`: `sonnet` — explicit, not inherited
- `prompt`: self-contained brief (subagents don't see the conversation). Spell out the question, relevant background, and ask for a ≤200-word report. Be explicit that the work is read-only: *"research only, no edits"*.
- `description`: 3–5 words for the activity log

Synthesize the returned briefs yourself in chat — don't dump raw reports at the user.

## Anti-patterns

| Don't | Do |
|---|---|
| Spawn a subagent for a 30-second grep | Just grep |
| Parallelize dependent queries | Serialize — the upstream answer reshapes the downstream question |
| Use `model: opus` for read-only research | `sonnet` — reserve Opus for synthesis and judgment turns |
| Let subagents Edit/Write/run destructive commands | Explicit "read-only" in the prompt; brainstorming forbids writes |
| Spawn 5+ subagents "to be thorough" | If you can't name the question each one answers in one sentence, you don't need it |
