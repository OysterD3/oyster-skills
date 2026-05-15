# Output artifacts

Two files share the slug.

- HTML (review): `<cwd>/docs/impl-plans/<YYYY-MM-DD>-<slug>.html`
- MD (canonical): `<cwd>/docs/impl-plans/<YYYY-MM-DD>-<slug>.md`

Reuse the spec's slug. **Same name exists?** Treat as a continuation — read, prepend a changelog row, update in place on BOTH files together. Don't write `-v2`. If it's unrelated work that collided, ask before clobbering.

## MD template (`assets/plan.tmpl.md`)

Plain markdown. Mermaid in fenced ` ```mermaid ` blocks.

| Placeholder | Content | Notes |
|---|---|---|
| `{{TITLE}}` | Short title | 3–8 words |
| `{{DATE}}` | `YYYY-MM-DD` | |
| `{{STATUS}}` | `Draft` initially, `Approved` after sign-off | |
| `{{SPEC_LINK}}` | Relative link to spec MD, or `none` | `[2026-05-13-foo.md](../specs/2026-05-13-foo.md)` |
| `{{GOAL}}` | One-sentence goal verbatim from spec | |
| `{{STRATEGY}}` | One paragraph + mermaid `flowchart TD` DAG | |
| `{{PREFLIGHT}}` | Bulleted preconditions | |
| `{{STEPS}}` | Numbered list using the Step template (see SKILL.md) | Each step as a subsection |
| `{{POSTFLIGHT}}` | Bulleted final checks | |
| `{{RISKS}}` | Execution-time risks + mitigations | |
| `{{NOTES}}` | Cross-cutting notes | |
| `{{CHANGELOG_ROWS_MD}}` | One row per revision, newest at top | See [Changelog](#changelog) |

## HTML template (`assets/plan.tmpl.html`)

Dark mode, Mermaid 11 + highlight.js from CDN, same visual language as spec-writing. Each step renders as a card with a numbered badge.

HTML-only metadata placeholders:

| Placeholder | Format |
|---|---|
| `{{STATUS_HTML}}` | `<span class="status-draft">Draft</span>` or `<span class="status-approved">Approved</span>` |
| `{{SPEC_LINK_HTML}}` | `<a href="../specs/<file>"><file></a>` or `<em>none — standalone plan</em>` |
| `{{STEPS_HTML}}` | Steps as `<article class="step">` cards (see structure below) |
| `{{CHANGELOG_ROWS}}` | One `<tr>` per revision, newest at top |

Content rules:

- Use HTML — `<ul>`, `<table>`, `<code>`, `<pre class="code">` — not raw markdown. Escape `<`, `>`, `&`.
- Code samples: `<pre class="code" data-lang="<lang>">…</pre>`. Common `data-lang`: `typescript`, `javascript`, `json`, `sql`, `bash`, `python`, `go`, `yaml`. Omit for auto-detect.
- Wrap diagrams as `<div class="diagram"><pre class="mermaid">…</pre></div>`.

## Step card structure

Use this exact structure (the template's CSS targets these class names):

```html
<article class="step" id="step-1">
  <header class="step-header">
    <span class="step-num">1</span>
    <h3>Add archived_at column to posts</h3>
    <span class="step-deps">depends on: none</span>
  </header>
  <p class="step-goal">Introduce the timestamp the API reads to decide whether a post is hidden from feeds.</p>
  <dl class="step-fields">
    <dt>Files</dt>
    <dd><ul><li><code>src/db/migrations/0042_add_archived_at.sql</code> — new migration</li></ul></dd>
    <dt>Changes</dt>
    <dd><ul><li>Add column <code>archived_at timestamptz NULL</code> to <code>posts</code></li></ul></dd>
    <dt>Tests</dt>
    <dd><ul><li><code>src/db/migrations/__tests__/0042.spec.ts</code> — migration applies and rolls back cleanly</li></ul></dd>
    <dt>Verification</dt>
    <dd><pre class="code">npm run db:migrate &amp;&amp; npm run db:inspect posts</pre></dd>
    <dt>Rollback</dt>
    <dd><code>npm run db:rollback</code> reverts to migration 0041.</dd>
  </dl>
</article>
```

For steps that change shared state (migrations, schema, feature flags, queue topology), add `rollback-required` to the `<article>` — template highlights with a warn-colored left border.

For manual steps (`Manual: yes — <reason>`), render with `<span class="step-deps">manual — <reason></span>` in the header and skip the verification field (subagents won't run it).

## Changelog

Both files keep a changelog at the top — HTML in a collapsible `<details>`, MD as a small table. Replaces `-v2` versioning.

**Initial write** — one row in each:

```html
<!-- HTML -->
<tr><td><time>YYYY-MM-DD HH:MM</time></td><td>Initial draft</td></tr>
```

```markdown
<!-- MD -->
| 2026-05-13 14:32 | Initial draft |
```

**Revision** — read existing, prepend a row, write back.

Rules:

- Timestamp: local time, 24-hour, minute-precision, at the revision moment.
- Note: one short sentence — what changed *and* why. For DAG changes, mention which wave was affected.
- Newest at top. Never delete older rows.
- After MD write-on-approval, copy ALL of the HTML's changelog rows into the MD's `## Changelog` table so both agree.

## Revision loop

If the user wants changes after reviewing the HTML:

1. Capture feedback in one batch.
2. Update the relevant steps (re-check the DAG if dependencies shifted).
3. Re-run self-review on changed sections — see [self-review.md](self-review.md).
4. **Update the HTML in place** and prepend a changelog row.
5. On final approval, write/update the MD in place and copy the changelog rows across.
