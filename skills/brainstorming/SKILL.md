---
name: brainstorming
description: Interview the user toward an agreed approach (plus the reasoning behind every load-bearing decision) before any non-trivial change. Triggers on "plan this", "help me plan", "how should we approach", "what's the best way to", and before EnterPlanMode. Researches the codebase first, probes every fork for "why A, not B", runs a security pass, produces a lean HTML review for teammate sign-off.
---

# Brainstorming

A relentless design interview. The output is a concrete **approach** — plus the reasoning behind every load-bearing decision — that a teammate can review without reading code.

## Operating rules

Non-negotiable. Violating any of them defeats the skill.

1. **Research before asking.** Never ask the user something a 60-second grep, file read, or doc lookup can answer.
2. **Batch independent questions; serialize dependent ones.** Use `AskUserQuestion` (1–4 items per call). A question pair is *dependent* if the answer to A would reshape what you'd ask for B — those go one at a time. *Independent* axes (e.g., auth model vs. storage backend vs. observability granularity) can be batched. When in doubt, serialize: a misplaced batch costs more than an over-cautious sequence.
3. **Every question surfaces a tradeoff or a gotcha.** A question with no tradeoff wastes the user's turn — replace it with a recommendation and ask for objection.
4. **Every decision has a "why".** For each load-bearing fork, capture *picked option*, *rejected option(s)*, and *one-line reason*. If the user can't articulate a reason, keep probing — "gut feel" is not a reason a teammate can review. Block sign-off until every decision has a non-empty "why".
5. **Challenge initial thoughts reasonably.** If the user's stated approach has a clear weakness (perf, security, complexity, lock-in, ops cost), name it and propose the alternative. Then let them choose. Do not capitulate to be agreeable; do not argue past one round if they hold firm.
6. **Security is a dedicated phase, not an afterthought.** No sign-off without it.
7. **The HTML is approach-only — no code or file references.** No paths, no function names, no concrete schema fields. Talk in surfaces ("auth layer", "forward worker"), roles, and behaviors. Concrete files/types/codes are spec-writing's job. The HTML must be reviewable by a teammate who has not opened the repo.
8. **Keep it lean.** The HTML is for review, not documentation. Prefer one tight sentence over a paragraph; prefer a table row over a sub-section. If a teammate would skim past it, cut it.
9. **No implementation during brainstorm.** Read-only investigation only — no Edit or destructive Bash. The single permitted write is the final HTML review document (see [HTML review document](#html-review-document)).

## Workflow checklist

Drive this with TodoWrite — one todo per item. Mark each complete as you go.

- [ ] **Restate the goal in one sentence.** Get the user to confirm before research. Catches misunderstandings cheaply.
- [ ] **Research the codebase.** Grep/read relevant files: existing patterns, the module that will change, similar features already shipped, the data model, the auth layer. Note conflicts between user's framing and what the code actually does. *This research informs your interview — it does not appear in the HTML.*
- [ ] **Research external context if libraries/APIs are involved.** Use `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` for library docs, or WebFetch for specific URLs. Skip if pure internal logic.
- [ ] **Summarize findings (chat only).** 3–6 bullets: what exists, what's missing, what surprised you, conflicts with the user's framing. Surface the riskiest unknown — that's where the interview starts.
- [ ] **Sketch mockup directions (UI only).** If the change introduces new visual surface (screen, page, modal, prominent component), propose 2–4 named layout directions with ASCII previews in a single `AskUserQuestion`. The pick frames the rest of the interview *and* becomes a decision row. See [UI mockup sampling](#ui-mockup-sampling). Skip for pure backend/schema/infra/refactor/copy work.
- [ ] **Interview loop.** Batch independent questions, serialize dependent ones (see operating rule #2). Continue until the plan answers: *what's the context, what's the approach, what are the load-bearing decisions and why each was picked, what compromises are accepted, what's out of scope, what's still unresolved.* See [Question patterns](#question-patterns) below.
- [ ] **Probe every decision for "why".** As decisions surface during the interview, log each one with `picked / rejected / why`. If a "why" is "user said so" or "gut feel", that's a flag to probe — ask for the underlying reason (perf, simplicity, lock-in concern, team familiarity, deadline pressure, etc.). A teammate reviewing the HTML wants the reason, not the verdict.
- [ ] **Challenge the initial approach at least once** if a credible better path exists. Cite the specific weakness. If the user holds firm after your reasoning, accept and record their reason in the "why" column — that's exactly the kind of context a reviewer wants.
- [ ] **Security pass.** Read [references/security-checklist.md](references/security-checklist.md) and walk the relevant items with the user. Mandatory — do not skip even when the change "feels" non-security. Output is one-line *Area · Decision* pairs; **no file paths or code references**.
- [ ] **Synthesize the approach in chat.** Format: *Goal · Context · Approach · Decisions (Decision/Picked/Rejected/Why) · Tradeoffs · Open questions · Security*. Keep iterating with the user until they signal agreement. Talk in surfaces, not files.
- [ ] **Verify "why" completeness.** Before offering sign-off, check every Decisions row has a non-empty *Why* (and that "why" is reviewable — i.e., a teammate could agree or push back on it). If any row is thin, loop back to the interview for that one decision.
- [ ] **Offer the optional roast.** Ask: "Want me to roast this plan before sign-off? An adversarial pass over the whole plan, or just focus on one area (security / ops cost / simpler alternative)? Or skip." Three options surfaced; one-question turn. If they pick a focused angle, pass it to `roast-me` as scope. Surface its verdict, fold any worthwhile concerns into a brief revision pass. If they skip, move on. Skipping is fine — this is opt-in.
- [ ] **Explicit sign-off in chat.** Ask: "Ready for me to write the review doc, or anything to revise first?" Wait for a clear yes.
- [ ] **Write the HTML review document.** See [HTML review document](#html-review-document) below. This is a hard checkpoint — the user must review the HTML before spec writing begins.
- [ ] **Ensure `docs/` is gitignored** (one-time per project). If you can read `.gitignore` and `docs/` (or `docs/brainstorming/`, etc.) is not listed, surface this to the user in one sentence: "Tip: add `docs/` to your `.gitignore` so brainstorming/spec/plan artifacts and inline-comment JSON files stay local — matches your stated 'specs/plans don't commit' rule." Do not auto-edit `.gitignore` — that's a project-level decision.
- [ ] **Start the review server** so the inline-comment system works. See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Stop and hand off.** Tell the user the URL (e.g. `http://localhost:7681/docs/brainstorming/<file>.html`) — not the file path. Do not start spec writing or implementation until they return with "looks good, move on" (or revisions).
- [ ] **Shut the review server down** when the user is moving on or approves the plan. See [Review server lifecycle](#review-server-lifecycle).

## Question patterns

Every question must do one of these. If it doesn't, don't ask it. After every answer, capture the *why* — that's what a teammate reads first.

### Surface a tradeoff
Frame as a fork with the cost of each branch named.
> "Two ways to handle dedupe: (a) DB unique constraint — atomic but throws on race, must catch a specific error; (b) advisory lock around the insert — cleaner error handling but serializes writes for that key. (a) is faster under low contention, (b) is friendlier if you'll do multi-row work in the same critical section. Which fits this flow — and what's the deciding factor?"

### Surface a gotcha
Name the trap before they step in it.
> "If we forward by message ID and the source chat later deletes that message, the upstream returns 400 and our retry queue stalls. Want to (a) cache content at forward-time and re-send on failure, or (b) accept the loss and log? (a) is more work but keeps history intact. What matters more here?"

### Challenge an assumption
Quote what they said, then the weakness, then the alternative.
> "You mentioned storing the API key on the SIM record. That puts a secret in a row read across the worker and the API, and it'll surface in any debug log of that row. A secrets table with restricted reads, or vault/env, would be safer. Is there a reason row-level placement is intentional?"

### Force a scope decision
When the user is conflating two features.
> "What you're describing is really two changes: the forwarding pipeline AND the audit trail. They have different failure modes. Both in this PR, or land forwarding first and audit as a follow-up — and why?"

### Probe a thin "why"
When the picked option is clear but the reason isn't.
> "You picked the lock approach over the unique constraint. Is the reason: (a) it composes with future multi-row work in the same critical section, (b) the team is more comfortable debugging lock contention than catching specific error codes, or (c) something else? I want to put the actual reason in the decisions table so a reviewer knows what to push back on if they disagree."

## UI mockup sampling

When the brainstorm touches new visual surface, hand the user concrete layouts to choose from *before* driving deeper questions — otherwise the rest of the interview shoots at an undefined target. The chosen direction frames everything downstream: which fields appear where, which actions are primary, which states need design.

**Sample when:** new screen, page, dashboard, list, detail view, modal, wizard; major restructure of an existing screen; a new component that lands in multiple places.

**Skip when:** pure backend, schema, infra, refactor, bug fix, or copy/color tweak. If unsure, ask once: *"Is there visual surface here, or is it pure logic?"*

### How

Produce **2–4 directions** that vary along ONE major axis — not random variants. Pick the axis that most shapes the user's tradeoff:

- *Information density*: table vs card grid vs split-pane
- *Flow shape*: wizard vs single form vs inline editing
- *Navigation*: sidebar vs tabs vs breadcrumb stack
- *Primary action surface*: header CTA vs floating action vs row-inline

Each option must include:

- A **name** (1–2 words: "Compact table", "Card grid", "Split-pane")
- An **ASCII preview** ~12 lines × 60 cols showing layout *zones*, not real content. Use box-drawing chars; mark interactive zones (`[btn]`, `▸`/`▾` for expand, `…` for overflow).
- A one-line **best for / tradeoff** tag

Present them in a **single `AskUserQuestion`** call — `header: "Mockup"`, `multiSelect: false` (previews aren't supported for multi-select). Each option's `preview` = the ASCII, `description` = the tradeoff.

After the pick: restate the choice in one sentence, then resume the interview with the chosen layout assumed (subsequent questions frame against it — *"in the split-pane variant, where does bulk-edit live?"*). Record the pick as a **Decisions** row — *Decision: Layout · Picked: split-pane · Rejected: compact table, card grid · Why: deep edit per item with few items in view at a time.*

### Higher-fidelity mockups

ASCII is intentional — brainstorming is read-only and fast. If the user wants pixel-fidelity mockups, that's the `frontend-design` skill's job *after* spec sign-off. Note the deferral in `{{TRADEOFFS}}` so it's tracked.

### Example sample set (settings page)

```
Compact table          Card grid              Split-pane
┌──────────────────┐   ┌────┐┌────┐┌────┐    ┌────┬───────────┐
│ filter…   [+ new]│   │name││name││name│    │ ▸  │ name      │
├──┬──────┬────────┤   │role││role││role│    │ ▸  │ email     │
│☐ │ row  │ … │   └────┘└────┘└────┘    │ ▾  │ role  ▾   │
│☐ │ row  │ … │   ┌────┐┌────┐┌────┐    │ ▸  │ ...       │
│☐ │ row  │ … │   │…   ││…   ││…   │    │    │           │
└──┴──────┴────────┘   └────┘└────┘└────┘    │    │  [save]   │
dense; bulk edit       scannable; per-       deep edit;
shines                 item primary action   fewer items
```

(Real previews live inside `AskUserQuestion` option `preview` fields — the table above is just to illustrate "different axes, similar visual budget".)

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
      "section": "Decisions",
      "quote": "advisory lock",
      "body": "the 'why' here is thin — is this about debugging ergonomics or composition with future multi-row work? worth tightening",
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
4. **Update the HTML in place.** Read the current file, regenerate with the revised content, and prepend a new row to the changelog table summarizing what changed (see [Changelog](#changelog)). The accumulated `comments.json` and changelog together form the audit trail — no `-v2` files.
5. In your reply, list each comment with the action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.

## Anti-patterns

| Don't | Do |
|---|---|
| "What do you think about X?" (no tradeoff) | "X vs Y — X is simpler, Y handles concurrent writes. Is concurrency a real concern here?" |
| Batch dependent questions in one turn | Ask the upstream one first — the answer will reshape the rest. Independent axes (auth model AND storage backend AND observability) are fine to batch up to 4 at a time. |
| Accept "let's just do it the simple way" without naming what gets deferred | "OK — simple way means no idempotency key. If the worker retries we'll double-send. Acceptable for now? I'll log that tradeoff." |
| Record a decision with empty or vague "why" ("user picked it", "gut feel") | Probe for the underlying reason — perf, simplicity, lock-in, deadline, team familiarity. If after probing the only honest "why" is "we don't know yet", surface that as an Open question instead of a Decision. |
| Reference file paths, function names, or types in the HTML | Talk in surfaces and roles ("forward worker", "auth layer"). Concrete files/types live in spec-writing. |
| Long prose sections in the HTML | One paragraph max per section. A reviewer skims; lean wins. |
| Skip security because "it's just a UI change" | UI changes touch input handling, authz, CSRF surface. Run the pass. |
| Scatter scratch plans across random files | Iterate in chat. The ONE permitted artifact is the final HTML review doc — written only after sign-off, only to `<cwd>/docs/brainstorming/`. |

## HTML review document

After sign-off in chat, write a single HTML file the user can open in a browser to do a final review before spec writing.

### Location and filename

- Directory: `<cwd>/docs/brainstorming/` — relative to the current working directory where the conversation started. Create the directory if missing.
- Filename: `<YYYY-MM-DD>-<kebab-slug>.html` where the slug is 2–5 words capturing the goal (e.g. `2026-05-13-telegram-forward-dedup.html`). Date sorts naturally; slug makes it scannable.
- **If a file with the same name already exists, treat it as a continuation.** Read it, prepend a new changelog row, and update in place. Don't write `-v2`. If the existing file is unrelated work that genuinely collided, ask the user before clobbering — they'll usually pick a different slug.

### How to render it

1. Read `assets/plan-template.html`. It contains `{{PLACEHOLDER}}` tokens. The template is dark-mode and loads Mermaid from CDN (`mermaid@11`) — diagrams render automatically.
2. Replace every placeholder with the agreed content. Use HTML — `<ul>`, `<table>`, `<code>`, mermaid blocks — not raw markdown. Escape `<`, `>`, `&` in user-supplied prose.
3. Write the result with the Write tool.

### Placeholder contract

The HTML is **approach-only**: no file paths, no function names, no concrete types or status codes. Every section earns its space — if it would be a yawn for a reviewer, cut it.

| Token | Content | Format |
|---|---|---|
| `{{TITLE}}` | Short title for the change | Plain text, ~3–8 words |
| `{{DATE}}` | Today's date | `YYYY-MM-DD` |
| `{{GOAL}}` | One-sentence goal the user confirmed | Plain text |
| `{{CONTEXT}}` | Why this matters *now* — the trigger, the pain, the constraint | 2–4 short `<li>` bullets or up to 2 short `<p>` sentences. No history dumps. |
| `{{APPROACH}}` | The approach in one paragraph: how the design behaves, in surfaces and roles. Optionally followed by ONE diagram if behavior is genuinely non-obvious. | `<p>…</p>` followed optionally by one `<div class="diagram"><pre class="mermaid">…</pre></div>`. See [Diagrams](#diagrams). Skip the diagram if a sentence is clearer. |
| `{{DECISIONS}}` | The **Why-A-not-B** table — every load-bearing fork the design closed on | `<table>` with columns *Decision*, *Picked*, *Rejected*, *Why*. Every row's *Why* must be non-empty and reviewable (a teammate could agree or push back on it). 2–6 rows typical; if you have more than 8, you're probably listing minor choices — fold them in. |
| `{{TRADEOFFS}}` | Compromises we accept + things explicitly out of scope, in one list | `<ul>` — each `<li>` names what's given up *and why we're OK with it now*. Prefix with `<strong>OUT:</strong>` for out-of-scope items, `<strong>ACCEPT:</strong>` for accepted compromises. |
| `{{OPEN_QUESTIONS}}` | Things still unresolved that a teammate should weigh in on | One `<li>` per question — already wrapped in `<ul class="risks">` by the template. End each with the question shape: *"…?"* |
| `{{SECURITY_SUMMARY}}` | One-line-per-area decision from the security pass — **no file paths or code references** | `<table>` with columns *Area*, *Decision*. Use "N/A — <reason>" for areas that didn't apply |
| `{{CHANGELOG_ROWS}}` | One `<tr>` per revision, newest at top | See [Changelog](#changelog) below |

### Changelog

The template includes a collapsible **Changelog** block in the header. It's the at-a-glance "what changed since the last review" — and replaces `-v2` versioning entirely.

**Initial write** — one row:

```html
<tr><td><time>YYYY-MM-DD HH:MM</time></td><td>Initial draft</td></tr>
```

**On every revision** — read the existing file, prepend a row, write the updated file back:

```html
<tr><td><time>YYYY-MM-DD HH:MM</time></td><td>Switched dedup to advisory lock per comment on Decisions</td></tr>
<tr><td><time>YYYY-MM-DD HH:MM</time></td><td>Initial draft</td></tr>
```

Rules:
- Timestamp is local time, 24-hour, minute-precision. Use the moment of the revision, not the brainstorm start.
- Note column: one short sentence — what changed *and* why (cite the comment, the new info, or the user request).
- Newest at top. Never delete older rows.
- Don't bundle two unrelated revisions into one row; add separate rows so each change is auditable.

### Diagrams

Diagrams are optional — only include one in `{{APPROACH}}` if a sentence can't convey the behavior. A diagram that mostly restates the paragraph is noise.

Wrap as:

```html
<div class="diagram"><pre class="mermaid">
  ...mermaid source...
</pre></div>
<p class="caption">Optional caption.</p>
```

Pick the type by what you're communicating:

| Default diagram | When to use |
|---|---|
| `sequenceDiagram` | Request/response, async pipelines, message passing, auth handshakes, webhook flows |
| `flowchart TD` | Decision logic, state transitions, branching workflows, validation paths |
| `stateDiagram-v2` | Entity lifecycle with discrete states (job status, subscription state) |

Diagram authoring rules:

- **Surfaces, not files.** Participants are roles ("API", "Worker", "Queue") — never file paths or class names.
- **No status codes, no concrete error names.** Label arrows with the verb (`enqueue`, `forward`, `retry on failure`), not `POST /v1/forward → 422 ALREADY_ENABLED`. That's spec-writing territory.
- Prefer one **clear** diagram over three rough ones. If you'd need to label half the arrows "(maybe)", you're not ready — go back to the interview.
- Keep it under ~12 nodes. If it's bigger, the approach is probably two changes wearing one coat — go back to scope.
- Do NOT use mermaid `click` handlers, embedded HTML, or external image refs — `securityLevel: "strict"` blocks them.

Example for a webhook-driven forward pipeline:

```html
<div class="diagram"><pre class="mermaid">
sequenceDiagram
  autonumber
  participant Src as Source
  participant API as API
  participant Q as Queue
  participant W as Worker
  Src->>API: incoming message
  API->>API: verify signature
  API->>Q: enqueue forward
  API-->>Src: ack
  Q->>W: dequeue
  W->>Src: forward
  alt source no longer reachable
    Src-->>W: not-found
    W->>W: log + drop (per plan)
  end
</pre></div>
<p class="caption">API acks immediately; worker handles delivery async, drops on irrecoverable source error.</p>
```

### After writing

Tell the user one short message containing the file path and that you're stopping. Suggest they `open <path>` (macOS) to view. Do not start spec writing or implementation. Wait for the user to come back with approval or revisions.

If they request revisions, re-run the relevant parts of the interview, then update the HTML in place and prepend a row to the [changelog](#changelog) describing what was revised. The `comments.json` plus changelog together are the audit trail.

## When to exit early

Exit without completing the checklist only if:

- The user explicitly says "skip the interview, just do X" — but still run the security pass if the change touches auth, secrets, user input, or PII, and still produce the HTML review unless the user also says "and skip the review doc".
- Research reveals the task is a pure lookup or trivial fix and the user agrees mid-stream. No HTML needed in this case.

In both cases, state explicitly that you're exiting brainstorm and why.
