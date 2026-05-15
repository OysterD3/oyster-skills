# Processing inline comments

When the user says "address the comments", read them from `<htmlpath>.comments.json` directly.

## Reading the comments

Use the Read tool on the comments JSON. Schema:

```json
{
  "file": "docs/test-reviews/2026-05-13-feature.html",
  "comments": [
    {
      "id": "cm1715539200abc",
      "section": "Test: archives an owned post",
      "quote": "archives an owned post",
      "body": "this test mocks the DB — rewrite to use real DB per project rule",
      "ts": "2026-05-13T19:30:00.000Z"
    }
  ]
}
```

Note: comments on test entries have `section: "Test: <name>"`; comments on a top-level section have `section: "<section name>"` (e.g. `Coverage map`, `Mock policy audit`).

## Processing each comment

Treat each as a revision request:

1. Use `section` + `quote` together to identify the test entry, coverage row, or section being commented on.
2. Group by intent — *test additions* ("we also need a test for X"), *test challenges* ("this test mocks the DB — rewrite"), *recategorizations* (e.g. unit → integration), *coverage corrections* (status was wrong), *questions*, *proposed-but-unclear*.
3. Apply edits. If a comment challenges a mock-policy verdict, re-run the relevant items of the coverage checklist.
4. Re-run self-review on changed sections — see [self-review.md](self-review.md).
5. **Update the HTML in place** and prepend a changelog row. Don't write/update the MD until the user re-approves the HTML.
6. In your reply, list each comment with action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.
