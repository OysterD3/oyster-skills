---
name: spec-writing
description: Turn an approved brainstorming HTML into a Markdown engineering spec. Trigger AFTER brainstorming sign-off when user says "move on to spec", "write the spec", or asks explicitly. Asks narrow clarifying questions only for spec-level gaps (exact types, error codes, validation rules), runs alignment + consistency self-review, HTML preview first, MD on approval. Outputs to `docs/specs/`.
---

# Spec writing

The spec is the engineering contract. After this is signed off, implementation should be possible without re-deriving any decision.

## Operating rules

1. **Brainstorming is the input, not the canvas.** Do not re-litigate decisions already made. If you disagree with a brainstorming decision, flag it as a single observation and let the user choose — do not relitigate the entire question.
2. **Narrow questions only.** Ask about spec-level details brainstorming legitimately couldn't have answered: exact types, error codes, validation bounds, acceptance criteria edges, observability specifics. Never re-ask architectural questions.
3. **Batch independent questions; serialize dependent ones.** Use `AskUserQuestion` (1–4 items). A pair is *dependent* if the answer to A would reshape what you'd ask for B. Same rule as brainstorming and impl-plan-writing.
4. **Self-review is mandatory.** The alignment + consistency pass is non-negotiable. No HTML render until it comes back clean.
5. **HTML before MD.** HTML is the review artifact. MD is the source of truth, written only after the user approves the HTML.
6. **No implementation.** Read-only investigation. The only writes are the spec artifacts themselves.

## Workflow checklist

Drive this with TodoWrite — one todo per item.

- [ ] **Locate brainstorming input.** Look in `<cwd>/docs/brainstorming/` for the latest HTML. Confirm with user: "Using `<filename>` as the source. Right one?" If none exists, see [No brainstorming artifact](#no-brainstorming-artifact).
- [ ] **Parse brainstorming.** Extract: Goal, Context, Approaches considered (the 2–3 options + which was picked + why), Approach (and any diagram), Decisions (Decision/Picked/Rejected/Why rows), Tradeoffs & out-of-scope, Open questions, Security pass decisions. Brainstorming is **approach-only** — it does NOT include file paths, concrete types, or status codes. Deriving those is *this* skill's job.
- [ ] **Read the relevant code.** This is where you ground the approach in reality — open the modules implied by the Approach: existing types, function signatures, error shapes, similar features already shipped. The list of files to touch and the concrete contract shape are produced *here*, not inherited from brainstorming.
- [ ] **Draft the spec internally.** Map brainstorming → spec sections per the [Mapping](#brainstorming--spec-mapping) below. Identify gaps that need narrow clarifying questions.
- [ ] **Ask narrow clarifying questions** for legitimate spec-level gaps. ONE at a time. See [Question scope](#question-scope). If there are none, skip this step.
- [ ] **Self-review.** Read [references/self-review-checklist.md](references/self-review-checklist.md) and run both passes. Output the review report in chat (the user benefits from seeing the rigor). Fix issues and re-run until clean.
- [ ] **Render HTML** to `<cwd>/docs/specs/<YYYY-MM-DD>-<slug>.html` using `assets/spec-template.html`. Same slug as the brainstorming file when continuing the same thread; otherwise derive from the goal.
- [ ] **Start the review server** (if not already running). See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Hand off for review.** Tell the user the URL (`http://localhost:7681/docs/specs/<file>.html`), not the file path. Stop and wait. Do not write the MD yet.
- [ ] **On approval, write MD** to `<cwd>/docs/specs/<YYYY-MM-DD>-<slug>.md` using `assets/spec-template.md`. Tell the user the path. This is the canonical artifact.
- [ ] **Shut the review server down** before handing off to impl-plan-writing. See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Stop.** Do not start implementation. The spec exists to be referenced during implementation, not to chain forward automatically.

## Chaining with brainstorming

This skill activates in two ways:

1. **Chained:** the brainstorming skill has handed off, user reviewed the HTML, and has now signaled to proceed ("looks good, move on", "go", "write the spec", or similar). Use the most recently-written brainstorming HTML as the input.
2. **Standalone:** the user explicitly invokes spec writing without a fresh brainstorming session. Look for an existing brainstorming artifact; if none, see below.

### No brainstorming artifact

If `<cwd>/docs/brainstorming/` is empty or doesn't exist, stop and ask the user one question:

> "There's no brainstorming artifact in `<cwd>/docs/brainstorming/`. Specs without a prior brainstorming pass tend to ship with unexamined assumptions. Options: (a) run the brainstorming skill first (recommended), (b) proceed standalone — I'll note this in the spec metadata so reviewers know decisions weren't pre-vetted. Which?"

If they choose (b), include in the spec metadata: `Brainstorming: none — decisions made during spec writing`.

## Question scope

Allowed (spec-level details):
- Exact field types, lengths, formats (`uuid` vs `ulid` vs `string`)
- HTTP status codes for specific error cases
- Validation bounds (min/max, regex shape)
- Pagination strategy (cursor vs offset, page size cap)
- Acceptance criteria edge cases ("does empty input return 200 with empty array, or 400?")
- Observability specifics (which metric, which log level, which alert threshold)
- Idempotency key derivation (which fields, hashed how)

Not allowed (re-litigation):
- Whether to do the feature at all
- Which approach to take among options brainstorming closed on
- Whether the architecture is correct
- Scope changes

If you find yourself wanting to ask a not-allowed question, instead: include a single observation in the spec's **Implementation notes** section ("Consider revisiting X if Y becomes a problem in practice") and move on.

## Brainstorming → spec mapping

Brainstorming gives you the **approach** (and the reasoning behind it). The spec adds the **implementation contract** (files, types, codes, observability). Map sections like this:

| Brainstorming section | Spec section(s) |
|---|---|
| Goal | **Goal** (verbatim or tightened) |
| Context | Folds into **Goal** preamble or **Implementation notes** opening — don't lose the "why now" framing |
| Approaches considered | Folds into **Implementation notes** as a one-paragraph "approach selection" note: which option won and why, with rejected options named so a reviewer can see the alternatives were weighed. Don't re-litigate the choice — it's signed off. |
| Approach (prose + optional diagram) | **Behavior** — refine the diagram with concrete endpoints, error names, state labels |
| Decisions (Decision/Picked/Rejected/Why) | The *Picked* option drives **API contracts**, **Data model**, **Error handling**, **Rollout**, or **Security** depending on what the decision is about. The *Why* should remain visible — preserve it inline as a short rationale note where the decision lands. Don't silently drop a rejected option without trace. |
| Tradeoffs &amp; out of scope | OUT items → spec **Out of scope** (verbatim or near). ACCEPT items → **Implementation notes** as documented compromises, with the brainstorming "why" preserved. |
| Open questions | If you've resolved one during code reading or clarifying questions → it becomes part of **Behavior**/**Error handling**/etc. Unresolved → spec **Open questions** with residual-risk note. |
| Security pass decisions | **Security** (each row becomes a concrete, testable requirement) |
| Security: deferred items | **Open questions** with explicit residual-risk note |

**Files to touch, exact types, status codes, validation bounds** are NOT in brainstorming — derive them yourself from code reading + Decisions. They live in **Implementation notes**, **API contracts**, **Data model**, and **Error handling** respectively.

**Acceptance criteria** is also new in the spec — derive from the goal + out-of-scope. Each one must be observable and testable.

## Self-review

After the draft is complete, run the review per [references/self-review-checklist.md](references/self-review-checklist.md). It defines two passes:

1. **Alignment** — every brainstorming decision is reflected in the spec; nothing silently dropped.
2. **Internal consistency** — the spec doesn't contradict itself (API codes defined, fields exist, acceptance criteria cover the goal, security mitigations are testable).

Output the review report in chat as a short table or bullet list. Mark each item ✓ / ⚠ / ✗. If anything is ⚠ or ✗, fix the spec and re-run until the report is all ✓. Only then render the HTML.

## Output artifacts

### Filenames

Both files share the slug. Date-prefixed for natural sort.

- HTML (review): `<cwd>/docs/specs/<YYYY-MM-DD>-<slug>.html`
- MD (canonical): `<cwd>/docs/specs/<YYYY-MM-DD>-<slug>.md`

Slug rules:
- 2–5 kebab-case words from the goal (e.g. `telegram-forward-dedup`)
- If continuing from a brainstorming file, reuse its slug for traceability
- **If a file with the same name already exists, treat it as a continuation.** Read it, prepend a new changelog row (see [Changelog](#changelog)), and update in place. Don't write `-v2`. If the existing file is unrelated work that genuinely collided, ask the user before clobbering.

### MD template (`assets/spec-template.md`)

Read it, replace placeholders, write the result. Plain markdown. Mermaid blocks use fenced code blocks (` ```mermaid `) so they render on GitHub and in any markdown viewer.

| Placeholder | Content | Notes |
|---|---|---|
| `{{TITLE}}` | Short title | 3–8 words |
| `{{DATE}}` | `YYYY-MM-DD` | |
| `{{STATUS}}` | `Draft` initially, `Approved` after user signs off on the MD | |
| `{{BRAINSTORMING_LINK}}` | Relative link to brainstorming file, or `none` | `[2026-05-13-telegram-forward.html](../brainstorming/2026-05-13-telegram-forward.html)` |
| `{{GOAL}}` | One-sentence goal | Plain text |
| `{{ACCEPTANCE_CRITERIA}}` | Numbered list of testable conditions | Each one observable |
| `{{OUT_OF_SCOPE}}` | Bulleted | Verbatim from brainstorming where possible |
| `{{BEHAVIOR}}` | Prose + mermaid diagrams | `flowchart` / `sequenceDiagram` / `stateDiagram-v2` |
| `{{API_CONTRACTS}}` | Endpoints, request/response shapes, error codes | Use code blocks for shapes |
| `{{DATA_MODEL}}` | Schema changes, mermaid `erDiagram` if non-trivial | Use `N/A — <reason>` if truly none |
| `{{ERROR_HANDLING}}` | Failure modes, retry policy, idempotency keys | Each failure mode → behavior |
| `{{SECURITY}}` | Concrete mitigations (authn/authz, input validation, secrets, rate limiting, audit, etc.) | Every item must be testable |
| `{{OBSERVABILITY}}` | Metrics, logs, alerts | What gets emitted, what gets alerted, threshold |
| `{{ROLLOUT}}` | Feature flag, migration order, rollback plan | |
| `{{OPEN_QUESTIONS}}` | Anything unresolved + deferred residual risks | Empty list means "none" |
| `{{IMPLEMENTATION_NOTES}}` | File-by-file change summary | Brief; this isn't a checklist for the implementer to follow blindly |
| `{{CHANGELOG_ROWS_MD}}` | One row per revision, newest at top | See [Changelog](#changelog) |

### HTML template (`assets/spec-template.html`)

Dark mode, Mermaid 11 from CDN, same visual language as brainstorming. Section placeholders match the MD template (`{{GOAL}}`, `{{ACCEPTANCE_CRITERIA}}`, etc.) but expect **HTML content**, not markdown.

Three HTML-only metadata placeholders:

| Placeholder | Format | Example |
|---|---|---|
| `{{STATUS_HTML}}` | `<span class="status-draft">Draft</span>` for draft, `<span class="status-approved">Approved</span>` after sign-off | colors render automatically |
| `{{BRAINSTORMING_LINK_HTML}}` | `<a href="../brainstorming/<file>">filename</a>` if linked, `<em>none — standalone spec</em>` if not | relative path from `docs/specs/` to `docs/brainstorming/` |
| `{{CHANGELOG_ROWS}}` | One `<tr>` per revision, newest at top | See [Changelog](#changelog) |

Content rules:

- Use HTML — `<ul>`, `<table>`, `<code>`, `<pre class="code">` for code blocks — not raw markdown. Escape `<`, `>`, `&` in user-supplied text.
- Acceptance criteria render best as `<ul class="ac-list">` (template auto-numbers as AC1, AC2, …).
- Wrap diagrams as:

  ```html
  <div class="diagram"><pre class="mermaid">
    ...mermaid source...
  </pre></div>
  ```

- Code samples (API contracts, JSON, SQL, command lines, type defs): use `<pre class="code" data-lang="<lang>">…</pre>`. The template auto-wraps the content in `<code class="language-<lang>">` and runs highlight.js at load. Common `data-lang` values: `typescript`, `javascript`, `json`, `sql`, `bash`, `python`, `go`, `yaml`, `http`. Omit `data-lang` for auto-detect. Don't add a `<code>` child yourself — the bootstrap does it.

## Changelog

Both files include a changelog at the top — HTML in a collapsible `<details>` block, MD as a small markdown table. The changelog is how readers see *what changed since last review* and replaces `-v2` versioning entirely.

**Initial write** — one row in each file.

HTML (`{{CHANGELOG_ROWS}}`):
```html
<tr><td><time>YYYY-MM-DD HH:MM</time></td><td>Initial draft</td></tr>
```

MD (`{{CHANGELOG_ROWS_MD}}`):
```markdown
| 2026-05-13 14:32 | Initial draft |
```

**On every revision** — read the existing file, prepend a new row, write the updated file back:

```html
<tr><td><time>2026-05-13 15:10</time></td><td>Return 422 on /forward when already enabled (per comment on API contracts)</td></tr>
<tr><td><time>2026-05-13 14:32</time></td><td>Initial draft</td></tr>
```

Rules:
- Timestamp: local time, 24-hour, minute-precision, taken at the moment of the revision.
- Note column: one short sentence — what changed *and* why (cite the comment / new info / user request).
- Newest at top. Never delete older rows.
- When the MD is written after HTML approval, copy ALL of the HTML's changelog rows into the MD's `## Changelog` table so the two files agree.

## Revision loop

If the user wants changes after reviewing the HTML:

1. Capture the feedback (one batch is fine; not a full interview).
2. Update the relevant spec sections.
3. Re-run the self-review pass on the changed sections.
4. **Update the HTML in place** — read the existing file, regenerate with the revised content, prepend a new row to the changelog (see [Changelog](#changelog)). No `-v2`.
5. When the user approves the final HTML, write the MD in place (also in place if it already exists), and copy the HTML's changelog rows into the MD's `## Changelog` table so both files agree.

## Review server lifecycle

The HTML review uses a tiny local server (bundled with the brainstorming skill: `~/.claude/skills/brainstorming/scripts/review-server.mjs`). The browser persists inline comments to `<htmlpath>.comments.json` next to the HTML.

### Launching

After writing the HTML, check whether the server is already up — only launch if not.

```bash
curl -sf http://localhost:7681/api/health > /dev/null 2>&1 && echo "already running" || echo "needs start"
```

If `needs start`, launch in background with `Bash` (`run_in_background: true`):

```bash
node ~/.claude/skills/brainstorming/scripts/review-server.mjs
```

Then wait ~1 second and re-check health. If `already running`, skip the launch — reuse it.

Give the user the URL, not the file path:

> Review your spec at **http://localhost:7681/docs/specs/2026-05-13-feature.html**. Select any text and click "💬 Comment" to leave inline feedback. When done, say "address the comments" or "approve and write the MD".

### Shutting down

After writing the MD and before handing off to impl-plan-writing:

```bash
curl -sf -X POST http://localhost:7681/api/shutdown > /dev/null
```

The server has a 30-minute idle timeout as a fallback.

## Processing inline comments

When the user says "address the comments", read them from `<htmlpath>.comments.json` directly — no copy-paste.

### Reading the comments

Use the Read tool on the comments JSON. Schema:

```json
{
  "file": "docs/specs/2026-05-13-feature.html",
  "comments": [
    {
      "id": "cm1715539200abc",
      "section": "API contracts",
      "quote": "POST /sim-cards/:id/forward",
      "body": "should return 422 on already-enabled, not 409",
      "ts": "2026-05-13T19:30:00.000Z"
    }
  ]
}
```

### Processing each comment

Treat each as a revision request:

1. Use `section` + `quote` together to locate the exact spot in the working spec.
2. Group by intent — *edits* (clear textual change), *questions* (need a one-line answer back), *proposed-but-unclear* (need a clarifying question).
3. Apply edits. Answer questions inline. Ask ONE clarifying question only if a "proposed-but-unclear" item truly needs disambiguation.
4. Re-run the self-review on the changed sections.
5. **Update the HTML in place** and prepend a changelog row summarizing the revision (see [Changelog](#changelog)). Don't write/update the MD until the user re-approves the HTML.
6. In your reply, list each comment with the action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.

## Anti-patterns

| Don't | Do |
|---|---|
| Copy brainstorming verbatim into the spec | Tighten and elaborate. Spec is more precise: types, codes, thresholds. |
| Skip self-review because "it looks fine" | Run it. The user picked alignment+consistency for a reason — pattern-match against the checklist. |
| Render HTML with `⚠` items still open | Fix first, render after. |
| Write the MD when the user hasn't approved the HTML | HTML first. MD only after explicit go. |
| Ask 3 clarifying questions in one turn | One at a time. If you can't pick the most important one, the spec isn't drafted enough yet. |
| Re-open architectural debates | Add an observation to Implementation notes, move on. |
