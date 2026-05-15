# Output artifacts

Two files share the slug.

- HTML (review): `<cwd>/docs/test-reviews/<YYYY-MM-DD>-<slug>.html`
- MD (canonical): `<cwd>/docs/test-reviews/<YYYY-MM-DD>-<slug>.md`

Slug rules:

- Chained: reuse the impl plan's slug.
- Audit: prefix with `audit-` plus the target name (`audit-payments`, `audit-auth-module`).
- **Same name exists?** Treat as a continuation — read, prepend a changelog row, update in place on BOTH files together. Don't write `-v2`. If it's unrelated work that collided, ask before clobbering.

## MD template (`assets/review.tmpl.md`)

Standard markdown. Tables for coverage maps. Mermaid in fenced ` ```mermaid ` blocks if a coverage diagram aids understanding (usually the table is enough).

| Placeholder | Content |
|---|---|
| `{{TITLE}}` | Short title (chained: feature name; audit: "Test audit — <target>") |
| `{{DATE}}` | `YYYY-MM-DD` |
| `{{STATUS}}` | `Draft` then `Approved` |
| `{{MODE}}` | `Chained` or `Audit` |
| `{{SOURCE_LINK}}` | Link to impl plan (chained) or target path (audit) |
| `{{SUMMARY}}` | One paragraph summary |
| `{{COVERAGE_MAP}}` | Coverage table |
| `{{PER_STEP_TESTS}}` | Per-step test plan (chained only; `N/A — audit mode` otherwise) |
| `{{TEST_INVENTORY}}` | Grouped by type |
| `{{MOCK_AUDIT}}` | Mock policy table |
| `{{DETERMINISM}}` | Determinism review |
| `{{SECURITY_TESTS}}` | Security tests section |
| `{{PERF_TESTS}}` | Performance tests section |
| `{{GAPS_RISKS}}` | Ranked gaps |
| `{{RECOMMENDATIONS}}` | Concrete test files to add |
| `{{CHANGELOG_ROWS_MD}}` | One row per revision, newest at top |

## HTML template (`assets/review.tmpl.html`)

Dark mode, Mermaid 11 + highlight.js from CDN, same visual language as the rest of the chain. Coverage map renders with status badges; colors auto-applied when the cell uses the right class.

HTML-only placeholders:

| Placeholder | Format |
|---|---|
| `{{STATUS_HTML}}` | `<span class="status-draft">Draft</span>` or `<span class="status-approved">Approved</span>` |
| `{{MODE_HTML}}` | `<span class="mode-chained">Chained</span>` or `<span class="mode-audit">Audit</span>` |
| `{{SOURCE_LINK_HTML}}` | `<a href="..">file</a>` |
| `{{CHANGELOG_ROWS}}` | One `<tr>` per revision, newest at top |

Coverage map status cells use:

```html
<td class="status-ok">✓ proposed</td>
<td class="status-warn">⚠ partial</td>
<td class="status-gap">✗ gap</td>
```

Test inventory entries use:

```html
<article class="test-entry">
  <span class="test-type test-type-unit">unit</span>
  <span class="test-name">archives an owned post</span>
  <code class="test-file">src/posts/posts.controller.spec.ts</code>
  <p class="test-intent">Asserts 200 + correct response body for the happy path.</p>
</article>
```

Test type classes: `test-type-unit`, `test-type-integration`, `test-type-e2e`, `test-type-security`, `test-type-perf`.

Code excerpts (test snippets, command samples): `<pre class="code" data-lang="<lang>">…</pre>`. Common `data-lang`: `typescript`, `javascript`, `python`, `go`, `bash`, `json`. Omit for auto-detect.

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
- Note: one short sentence — what changed *and* why (cite the comment / new info / user request).
- Newest at top. Never delete older rows.
- After MD write-on-approval, copy ALL of the HTML's changelog rows into the MD's `## Changelog` table.

## Revision loop

If the user wants changes after the HTML review:

1. Capture feedback in one batch.
2. Update the relevant sections.
3. Re-run self-review on changed sections — see [self-review.md](self-review.md).
4. **Update the HTML in place** and prepend a changelog row.
5. On final approval, write/update the MD in place and copy the changelog rows across.
