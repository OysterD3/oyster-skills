# Processing inline comments

When the user says "address the comments", read them from `<htmlpath>.comments.json` directly.

## Reading the comments

Use the Read tool on the comments JSON. Schema:

```json
{
  "file": "docs/impl-plans/2026-05-13-feature.html",
  "comments": [
    {
      "id": "cm1715539200abc",
      "section": "Step: Add controller POST /posts/:id/archive",
      "quote": "Add controller POST /posts/:id/archive",
      "body": "split this — there's also the worker handler logic not covered",
      "ts": "2026-05-13T19:30:00.000Z"
    }
  ]
}
```

Note: comments on step cards have `section: "Step: <title>"`; comments on a top-level section have `section: "<section name>"` (e.g. `Strategy`, `Rollout`).

## Processing each comment

Treat each as a revision request:

1. Use `section` + `quote` together to find the step or section being commented on.
2. Group by intent — *edits*, *step splits/merges* (a step too big/small), *dependency changes* (rewire the DAG), *questions*, *proposed-but-unclear*.
3. Apply edits. If the DAG changes, re-derive waves and verify acyclicity. If a step is split, update downstream `Depends on` references.
4. Re-run self-review on changed sections — see [self-review.md](self-review.md).
5. **Update the HTML in place** and prepend a changelog row. Don't write/update the MD until the user re-approves the HTML.
6. In your reply, list each comment with action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.
