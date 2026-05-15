# Output artifacts

Two files share the slug. Date-prefixed for natural sort.

- HTML (review): `<cwd>/docs/specs/<YYYY-MM-DD>-<slug>.html`
- MD (canonical): `<cwd>/docs/specs/<YYYY-MM-DD>-<slug>.md`

Slug rules:

- 2–5 kebab-case words from the goal (e.g. `posts-archive-idempotent`).
- Reuse the brainstorming slug if continuing the same thread.
- **Same name exists?** Treat as a continuation. Read, prepend a changelog row, update in place. Don't write `-v2`. If it's unrelated work that collided, ask before clobbering.

## MD template (`assets/spec.tmpl.md`)

Read, replace placeholders, write. Plain markdown. Mermaid in fenced ` ```mermaid ` blocks (renders on GitHub).

| Placeholder | Content | Notes |
|---|---|---|
| `{{TITLE}}` | Short title | 3–8 words |
| `{{DATE}}` | `YYYY-MM-DD` | |
| `{{STATUS}}` | `Draft` initially, `Approved` after sign-off | |
| `{{BRAINSTORMING_LINK}}` | Relative link to brainstorming file, or `none` | `[2026-05-13-posts-archive.html](../brainstorming/2026-05-13-posts-archive.html)` |
| `{{GOAL}}` | One-sentence goal | Plain text |
| `{{ACCEPTANCE_CRITERIA}}` | Numbered list of testable conditions | Each observable |
| `{{OUT_OF_SCOPE}}` | Bulleted | Verbatim from brainstorming where possible |
| `{{BEHAVIOR}}` | Prose + mermaid | `flowchart` / `sequenceDiagram` / `stateDiagram-v2` |
| `{{API_CONTRACTS}}` | Endpoints, request/response shapes, error codes | Code blocks for shapes |
| `{{DATA_MODEL}}` | Schema changes, mermaid `erDiagram` if non-trivial | `N/A — <reason>` if none |
| `{{ERROR_HANDLING}}` | Failure modes, retry policy, idempotency keys | Each failure mode → behavior |
| `{{SECURITY}}` | Concrete mitigations (authn/authz, validation, secrets, rate limits, audit) | Every item testable |
| `{{OBSERVABILITY}}` | Metrics, logs, alerts | What's emitted, what's alerted, threshold |
| `{{ROLLOUT}}` | Feature flag, migration order, rollback plan | |
| `{{OPEN_QUESTIONS}}` | Unresolved + deferred residual risks | Empty list = none |
| `{{IMPLEMENTATION_NOTES}}` | File-by-file change summary | Brief; not a checklist for blind execution |
| `{{CHANGELOG_ROWS_MD}}` | One row per revision, newest at top | See [Changelog](#changelog) |

## HTML template (`assets/spec.tmpl.html`)

Dark mode, Mermaid 11 + highlight.js from CDN, same visual language as brainstorming. Section placeholders match the MD template (`{{GOAL}}`, `{{ACCEPTANCE_CRITERIA}}`, etc.) but expect **HTML content**, not markdown.

HTML-only metadata placeholders:

| Placeholder | Format |
|---|---|
| `{{STATUS_HTML}}` | `<span class="status-draft">Draft</span>` or `<span class="status-approved">Approved</span>` (colors auto-applied) |
| `{{BRAINSTORMING_LINK_HTML}}` | `<a href="../brainstorming/<file>">filename</a>` or `<em>none — standalone spec</em>` |
| `{{CHANGELOG_ROWS}}` | One `<tr>` per revision, newest at top |

Content rules:

- Use HTML — `<ul>`, `<table>`, `<code>`, `<pre class="code">` — not raw markdown. Escape `<`, `>`, `&` in user-supplied text.
- Acceptance criteria render best as `<ul class="ac-list">` (template auto-numbers as AC1, AC2, …).
- Wrap diagrams as `<div class="diagram"><pre class="mermaid">…</pre></div>`.
- Code samples: `<pre class="code" data-lang="<lang>">…</pre>`. Common `data-lang`: `typescript`, `javascript`, `json`, `sql`, `bash`, `python`, `go`, `yaml`, `http`. Omit `data-lang` for auto-detect. Don't add a `<code>` child — the bootstrap does it.

## Changelog

Both files keep a changelog at the top — HTML in a collapsible `<details>`, MD as a small table. Replaces `-v2` versioning entirely.

**Initial write** — one row in each:

```html
<!-- HTML -->
<tr><td><time>YYYY-MM-DD HH:MM</time></td><td>Initial draft</td></tr>
```

```markdown
<!-- MD -->
| 2026-05-13 14:32 | Initial draft |
```

**On every revision** — read existing, prepend a row, write back:

```html
<tr><td><time>2026-05-13 15:10</time></td><td>Return 422 on /posts/:id/archive when already archived (per comment on API contracts)</td></tr>
<tr><td><time>2026-05-13 14:32</time></td><td>Initial draft</td></tr>
```

Rules:

- Timestamp: local time, 24-hour, minute-precision, at the revision moment.
- Note: one short sentence — what changed *and* why.
- Newest at top. Never delete older rows.
- After MD write-on-approval, copy ALL of the HTML's changelog rows into the MD's `## Changelog` table so both agree.

## Revision loop

If the user wants changes after reviewing the HTML:

1. Capture feedback (one batch is fine; not a full interview).
2. Update the relevant spec sections.
3. Re-run self-review on the changed sections — see [self-review.md](self-review.md).
4. **Update the HTML in place** and prepend a changelog row.
5. On HTML re-approval, write/update the MD in place; copy the HTML's changelog rows into the MD's `## Changelog` table.
