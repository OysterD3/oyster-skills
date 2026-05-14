# Processing inline comments

When the user says "address the comments" (or similar), the comments are sitting in a JSON file next to the HTML — no copy-paste required.

## Reading the comments

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

## Processing each comment

Treat each comment as a revision request:

1. Use the `section` + `quote` together to locate the exact spot in your working plan. `section` maps directly to a content JSON field (e.g., "Decisions" → `decisions`).
2. Group by intent — *edits* (clear textual change), *questions* (need a one-line answer back), *proposed-but-unclear* (need a clarifying question).
3. Apply the edits. Answer questions inline in chat. Ask ONE clarifying question only if a "proposed-but-unclear" item truly needs disambiguation.
4. **Update the content JSON in place.** Read `<slug>.content.json`, modify the relevant fields, prepend a changelog entry summarizing what changed and why. The HTML shell does not change. The accumulated `comments.json` plus the changelog form the audit trail — no `-v2` files.
5. In your reply, list each comment with the action taken (`✓ applied`, `→ answered inline`, `? clarification needed`) so the user can verify nothing was missed.
