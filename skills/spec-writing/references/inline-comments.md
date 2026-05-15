# Processing inline comments

When the user says "address the comments", read them from `<htmlpath>.comments.json` directly — no copy-paste.

## Reading the comments

Use the Read tool on the comments JSON. Schema:

```json
{
  "file": "docs/specs/2026-05-13-feature.html",
  "comments": [
    {
      "id": "cm1715539200abc",
      "section": "API contracts",
      "quote": "POST /posts/:id/archive",
      "body": "should return 422 on already-archived, not 409",
      "ts": "2026-05-13T19:30:00.000Z"
    }
  ]
}
```

## Processing each comment

Treat each as a revision request:

1. Use `section` + `quote` together to locate the spot in the working spec.
2. Group by intent — *edits* (clear textual change), *questions* (need a one-line answer), *proposed-but-unclear* (need a clarifying question).
3. Apply edits. Answer questions inline. Ask ONE clarifying question only if a "proposed-but-unclear" item truly needs disambiguation.
4. Re-run self-review on the changed sections — see [self-review.md](self-review.md).
5. **Update the HTML in place** and prepend a changelog row. Don't write/update the MD until the user re-approves the HTML.
6. In your reply, list each comment with the action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.
