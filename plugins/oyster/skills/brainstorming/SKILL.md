---
name: brainstorming
description: Interview the user toward an agreed plan before any non-trivial change (new feature, refactor across files, schema/API change, new dependency). Triggers on "plan this", "help me plan", "how should we approach", "what's the best way to", and before EnterPlanMode. Researches the codebase first, asks tradeoff/gotcha questions, runs a security pass, produces an HTML review.
---

# Brainstorming

A relentless design interview. The output is a concrete plan the user has explicitly signed off on — not a vibe, not a sketch.

## Operating rules

Non-negotiable. Violating any of them defeats the skill.

1. **Research before asking.** Never ask the user something a 60-second grep, file read, or doc lookup can answer.
2. **Batch independent questions; serialize dependent ones.** Use `AskUserQuestion` (1–4 items per call). A question pair is *dependent* if the answer to A would reshape what you'd ask for B — those go one at a time. *Independent* axes (e.g., auth model vs. storage backend vs. observability granularity) can be batched. When in doubt, serialize: a misplaced batch costs more than an over-cautious sequence.
3. **Every question surfaces a tradeoff or a gotcha.** A question with no tradeoff wastes the user's turn — replace it with a recommendation and ask for objection.
4. **Challenge initial thoughts reasonably.** If the user's stated approach has a clear weakness (perf, security, complexity, lock-in, ops cost), name it and propose the alternative. Then let them choose. Do not capitulate to be agreeable; do not argue past one round if they hold firm.
5. **Security is a dedicated phase, not an afterthought.** No sign-off without it.
6. **No implementation during brainstorm.** Read-only investigation only — no Edit or destructive Bash. The single permitted write is the final HTML review document (see [HTML review document](#html-review-document)).

## Workflow checklist

Drive this with TodoWrite — one todo per item. Mark each complete as you go.

- [ ] **Restate the goal in one sentence.** Get the user to confirm before research. Catches misunderstandings cheaply.
- [ ] **Research the codebase.** Grep/read relevant files: existing patterns, the module that will change, similar features already shipped, the data model, the auth layer. Note conflicts between user's framing and what the code actually does.
- [ ] **Research external context if libraries/APIs are involved.** Use `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` for library docs, or WebFetch for specific URLs. Skip if pure internal logic.
- [ ] **Summarize findings.** 3–6 bullets: what exists, what's missing, what surprised you, conflicts with the user's framing. Surface the riskiest unknown — that's where the interview starts.
- [ ] **Interview loop.** Batch independent questions, serialize dependent ones (see operating rule #2). Continue until the plan answers: *which files change, what contracts/types, what data flow, what failure modes, what's explicitly out of scope*. See [Question patterns](#question-patterns) below.
- [ ] **Challenge the initial approach at least once** if a credible better path exists. Cite the specific weakness. If the user holds firm after your reasoning, accept and move on.
- [ ] **Security pass.** Read [references/security-checklist.md](references/security-checklist.md) and walk the relevant items with the user. Mandatory — do not skip even when the change "feels" non-security.
- [ ] **Synthesize the plan in chat.** Format: *Goal · Files to touch · Data/contract changes · Execution order · Out of scope · Open risks*. Keep iterating with the user until they signal agreement.
- [ ] **Offer the optional roast.** Ask: "Want me to roast this plan before sign-off? An adversarial pass over the whole plan, or just focus on one area (security / ops cost / simpler alternative)? Or skip." Three options surfaced; one-question turn. If they pick a focused angle, pass it to `roast-me` as scope. Surface its verdict, fold any worthwhile concerns into a brief revision pass. If they skip, move on. Skipping is fine — this is opt-in.
- [ ] **Explicit sign-off in chat.** Ask: "Ready for me to write the review doc, or anything to revise first?" Wait for a clear yes.
- [ ] **Write the HTML review document.** See [HTML review document](#html-review-document) below. This is a hard checkpoint — the user must review the HTML before spec writing begins.
- [ ] **Ensure `docs/` is gitignored** (one-time per project). If you can read `.gitignore` and `docs/` (or `docs/brainstorming/`, etc.) is not listed, surface this to the user in one sentence: "Tip: add `docs/` to your `.gitignore` so brainstorming/spec/plan artifacts and inline-comment JSON files stay local — matches your stated 'specs/plans don't commit' rule." Do not auto-edit `.gitignore` — that's a project-level decision.
- [ ] **Start the review server** so the inline-comment system works. See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Stop and hand off.** Tell the user the URL (e.g. `http://localhost:7681/docs/brainstorming/<file>.html`) — not the file path. Do not start spec writing or implementation until they return with "looks good, move on" (or revisions).
- [ ] **Shut the review server down** when the user is moving on or approves the plan. See [Review server lifecycle](#review-server-lifecycle).

## Question patterns

Every question must do one of these. If it doesn't, don't ask it.

### Surface a tradeoff
Frame as a fork with the cost of each branch named.
> "Two ways to handle dedupe: (a) DB unique constraint — atomic but throws on race, must catch a specific Postgres error code; (b) advisory lock around the insert — cleaner error handling but serializes writes for that key. (a) is faster under low contention, (b) is friendlier if you'll do multi-row work in the same critical section. Which fits this flow?"

### Surface a gotcha
Name the trap before they step in it.
> "If we forward by message ID and the source chat later deletes that message, Telegram returns 400 and our retry queue stalls. Want to (a) cache content at forward-time and re-send on failure, or (b) accept the loss and log? (a) is more work but keeps history intact."

### Challenge an assumption
Quote what they said, then the weakness, then the alternative.
> "You mentioned storing the API key on the SimCards row. That puts a secret in a record read across the worker and the API, and it'll surface in any debug log of that row. A `secrets` table with restricted reads, or vault/env, would be safer. Is there a reason row-level placement is intentional?"

### Force a scope decision
When the user is conflating two features.
> "What you're describing is really two changes: the forwarding pipeline AND the audit trail. They have different failure modes. Both in this PR, or land forwarding first and audit as a follow-up?"

## Review server lifecycle

The HTML review uses a tiny local server (`scripts/review-server.mjs`) to persist inline comments. The browser talks to `http://localhost:7681`; the server writes each page's comments to `<htmlpath>.comments.json` next to the HTML.

### Launching

After writing the HTML (and before telling the user the URL), check whether the server is already up — only launch if it isn't.

```bash
curl -sf http://localhost:7681/api/health > /dev/null 2>&1 && echo "already running" || echo "needs start"
```

If `needs start`, launch in background with `Bash` (`run_in_background: true`):

```bash
node ~/.claude/skills/brainstorming/scripts/review-server.mjs
```

Then wait ~1 second and re-check health. If `already running`, skip the launch — reuse it.

Give the user the URL, not the file path:

> Review your plan at **http://localhost:7681/docs/brainstorming/2026-05-13-feature.html**. Select any text and click "💬 Comment" to leave inline feedback. When done, tell me "address the comments" or "looks good, move on".

### Shutting down

When the user signals they're done with this skill (approves the plan, says "move on", or you're handing off to the next skill in the chain), shut the server down:

```bash
curl -sf -X POST http://localhost:7681/api/shutdown > /dev/null
```

The server also has a 30-minute idle timeout, so if you forget, it cleans itself up.

If the next skill (spec-writing) launches it again, that's a one-second cost — not worth optimizing for.

## Processing inline comments

When the user says "address the comments" (or similar), the comments are sitting in a JSON file next to the HTML — no copy-paste required.

### Reading the comments

The comments file is at `<htmlpath>.comments.json`. For example, if the HTML is `docs/brainstorming/2026-05-13-feature.html`, the comments live at `docs/brainstorming/2026-05-13-feature.comments.json`. Read it with the Read tool. The schema:

```json
{
  "file": "docs/brainstorming/2026-05-13-feature.html",
  "comments": [
    {
      "id": "cm1715539200abc",
      "section": "Open risks",
      "quote": "race condition on dedup",
      "body": "this should be addressed in the spec, not deferred — call it out as a must-have AC",
      "ts": "2026-05-13T19:30:00.000Z"
    }
  ]
}
```

### Processing each comment

Treat each comment as a revision request:

1. Use the `section` + `quote` together to locate the exact spot in your working plan.
2. Group by intent — *edits* (clear textual change), *questions* (need a one-line answer back), *proposed-but-unclear* (need a clarifying question).
3. Apply the edits. Answer questions inline in chat. Ask ONE clarifying question only if a "proposed-but-unclear" item truly needs disambiguation.
4. Regenerate the HTML as `-v2` — don't mutate the original. (The v1 HTML and its `comments.json` together form the audit trail of what was considered.)
5. In your reply, list each comment with the action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.

If only one or two trivial comments need addressing (typo, one-word fix), you can revise in-place without a version bump — ask the user which they prefer if it's ambiguous.

## Anti-patterns

| Don't | Do |
|---|---|
| "What do you think about X?" (no tradeoff) | "X vs Y — X is simpler, Y handles concurrent writes. Is concurrency a real concern here?" |
| Batch dependent questions in one turn | Ask the upstream one first — the answer will reshape the rest. Independent axes (auth model AND storage backend AND observability) are fine to batch up to 4 at a time. |
| Accept "let's just do it the simple way" without naming what gets deferred | "OK — simple way means no idempotency key. If the worker retries we'll double-send. Acceptable for now?" |
| Skip security because "it's just a UI change" | UI changes touch input handling, authz, CSRF surface. Run the pass. |
| Scatter scratch plans across random files | Iterate in chat. The ONE permitted artifact is the final HTML review doc — written only after sign-off, only to `<cwd>/docs/brainstorming/`. |

## HTML review document

After sign-off in chat, write a single HTML file the user can open in a browser to do a final review before spec writing.

### Location and filename

- Directory: `<cwd>/docs/brainstorming/` — relative to the current working directory where the conversation started. Create the directory if missing.
- Filename: `<YYYY-MM-DD>-<kebab-slug>.html` where the slug is 2–5 words capturing the goal (e.g. `2026-05-13-telegram-forward-dedup.html`). Date sorts naturally; slug makes it scannable.
- Never overwrite an existing file. If a filename collides, append `-v2`, `-v3`, etc.

### How to render it

1. Read `assets/plan-template.html`. It contains `{{PLACEHOLDER}}` tokens. The template is dark-mode and loads Mermaid from CDN (`mermaid@11`) — diagrams render automatically.
2. Replace every placeholder with the agreed content. Use HTML — `<ul>`, `<table>`, `<code>`, mermaid blocks — not raw markdown. Escape `<`, `>`, `&` in user-supplied prose.
3. Write the result with the Write tool.

### Placeholder contract

| Token | Content | Format |
|---|---|---|
| `{{TITLE}}` | Short title for the change | Plain text, ~3–8 words |
| `{{DATE}}` | Today's date | `YYYY-MM-DD` |
| `{{GOAL}}` | One-sentence goal the user confirmed | Plain text |
| `{{FLOW}}` | Primary diagram(s) for how the change behaves at runtime | One or more `<div class="diagram"><pre class="mermaid">…</pre></div>` blocks, optionally followed by `<p class="caption">…</p>`. See [Diagrams](#diagrams). If no flow makes sense (pure config/refactor), use `<p>No new runtime flow — refactor of existing behavior. See <a href="#files">Files to touch</a>.</p>` |
| `{{FILES}}` | Files to touch, grouped if useful | `<table>` with columns *File* and *Change* — wrap paths in `<code>` |
| `{{DATA_CHANGES}}` | Schema, DTO, API contract changes | `<ul>` or `<table>`. If schema is non-trivial, include an `erDiagram` mermaid block. Use `<p>None.</p>` if truly nothing changes. |
| `{{EXECUTION_ORDER}}` | Numbered build sequence | `<ol>` |
| `{{OUT_OF_SCOPE}}` | What is explicitly NOT in this change | `<ul>` |
| `{{OPEN_RISKS}}` | Unresolved risks, deferred mitigations from the security pass | One `<li>` per risk — already wrapped in `<ul class="risks">` by the template |
| `{{SECURITY_SUMMARY}}` | One-line-per-section summary of the security pass | `<table>` with columns *Area*, *Decision*. Use "N/A — <reason>" for sections that didn't apply |

### Diagrams

The template ships with Mermaid configured for dark mode. Drop diagrams wherever they aid understanding — always wrapped as:

```html
<div class="diagram"><pre class="mermaid">
  ...mermaid source...
</pre></div>
<p class="caption">Optional caption.</p>
```

Pick the diagram type by what the section is communicating:

| Section | Default diagram | When to use |
|---|---|---|
| `{{FLOW}}` | `sequenceDiagram` | Request/response, async pipelines, message passing, auth handshakes, webhook flows |
| `{{FLOW}}` | `flowchart TD` | Decision logic, state transitions, branching workflows, validation paths |
| `{{FLOW}}` | `stateDiagram-v2` | Entity lifecycle with discrete states (job status, subscription state) |
| `{{DATA_CHANGES}}` | `erDiagram` | New tables, new relationships, foreign key changes |
| `{{DATA_CHANGES}}` | `classDiagram` | DTO/interface shapes when ERD doesn't fit (NoSQL, API contracts) |

Diagram authoring rules:

- Prefer one **clear** diagram over three rough ones. If you'd need to label half the arrows "(maybe)", you're not ready — go back to the interview.
- Keep each diagram under ~15 nodes. If it's bigger, split by phase or zoom level.
- Label every arrow with the verb (`POST /messages`, `enqueue`, `emits event`). Unlabeled arrows are noise.
- For ERDs, only show columns that matter for the change. Don't dump every column.
- Do NOT use mermaid `click` handlers, embedded HTML, or external image refs — `securityLevel: "strict"` blocks them.

Example sequence diagram for a webhook flow:

```html
<div class="diagram"><pre class="mermaid">
sequenceDiagram
  autonumber
  participant TG as Telegram
  participant API as API
  participant Q as Queue
  participant W as Worker
  TG->>API: POST /webhook (message)
  API->>API: verify signature
  API->>Q: enqueue forward job
  API-->>TG: 200 OK
  Q->>W: dequeue
  W->>TG: sendMessage (forward)
  alt source deleted
    TG-->>W: 400 message not found
    W->>W: log + drop (per plan)
  end
</pre></div>
<p class="caption">Forward pipeline: API responds to TG immediately, worker handles delivery async.</p>
```

### After writing

Tell the user one short message containing the file path and that you're stopping. Suggest they `open <path>` (macOS) to view. Do not start spec writing or implementation. Wait for the user to come back with approval or revisions.

If they request revisions, re-run the relevant parts of the interview, then write a new `-v2` file rather than mutating the original — the prior version is the audit trail of what was considered.

## When to exit early

Exit without completing the checklist only if:

- The user explicitly says "skip the interview, just do X" — but still run the security pass if the change touches auth, secrets, user input, or PII, and still produce the HTML review unless the user also says "and skip the review doc".
- Research reveals the task is a pure lookup or trivial fix and the user agrees mid-stream. No HTML needed in this case.

In both cases, state explicitly that you're exiting brainstorm and why.
