# Review artifact

After sign-off, write a small content JSON + a thin shell HTML. The shell is a static presentation wrapper — it fetches the JSON at load and renders. Every revision touches only the JSON; the shell is written once and never touched again. The review server (and any tunnel forwarding it) must be running to view the artifact.

## Files

- Directory: `<cwd>/docs/brainstorming/` — relative to the current working directory where the conversation started. Create if missing.
- Slug: 2–5 kebab-case words capturing the goal (e.g. `posts-archive-idempotent`). Date-prefixed for natural sort.
- Two files share the slug:
  - `<YYYY-MM-DD>-<slug>.html` — the shell. ~80 lines. Written once.
  - `<YYYY-MM-DD>-<slug>.content.json` — all the variable content. This is what revisions edit.
- **If a file with the same slug already exists, treat it as a continuation.** Read the JSON, edit fields, prepend a changelog entry, write the JSON back. Don't write `-v2`. If the existing files are unrelated work that genuinely collided, ask the user before clobbering.

## Initial write

1. Read `assets/shell.html` (in the skill).
2. Write it **verbatim** to `<cwd>/docs/brainstorming/<slug>.html` — no token replacement, no interpolation. The shell pulls everything from the JSON.
3. Write `<cwd>/docs/brainstorming/<slug>.content.json` with the fields described in [Content JSON contract](#content-json-contract).

The shell references the shared CSS and JS at `/__shell/_shared/shell.css` and `/__shell/_shared/shell.js` — both served by the review server from the shared asset directory. No copying into the project.

## Revisions

The shell never changes after first write. To revise:

1. Read the existing `<slug>.content.json`.
2. Apply edits to the relevant fields.
3. Prepend a new entry to the `changelog` array describing what changed.
4. Write the JSON back.

Token cost per revision is just the JSON delta — much smaller than re-rendering an entire HTML doc.

## Content JSON contract

The JSON is **approach-only**: no file paths, no function names, no concrete types or status codes. Every field earns its space — if it would be a yawn for a reviewer, omit it (empty string or empty list).

| Key | Content | Format |
|---|---|---|
| `title` | Short title for the change | Plain text, ~3–8 words. Drives `<title>` and `<h1>`. |
| `date` | Today's date | `YYYY-MM-DD` |
| `goal` | One-sentence goal the user confirmed | Plain text |
| `context` | Why this matters *now* — the trigger, the pain, the constraint | HTML string: a `<ul>` of 2–4 short `<li>` bullets or 1–2 short `<p>` sentences. No history dumps. |
| `approachesConsidered` | The 2–3 structurally distinct approaches you proposed + which was picked + why | HTML string: `<table class="approaches">` with columns *Approach*, *Gist*, *Tradeoff*, *Status*. Picked row gets `class="picked"` and Status = `✓ Picked — <one-line reason>`. Rejected rows get Status = `Rejected — <one-line reason>`. If only one credible approach existed, single Picked row plus a `<p class="caption">No credible alternative — <reason>.</p>` below. |
| `approach` | The *chosen* approach in one paragraph | HTML string: `<p>…</p>` optionally followed by ONE `<div class="diagram"><pre class="mermaid">…</pre></div>`. See [Diagrams](#diagrams). |
| `decisions` | The Why-A-not-B table | HTML string: `<table>` with columns *Decision*, *Picked*, *Rejected*, *Why*. Every row's *Why* must be non-empty and reviewable. 2–6 rows typical. |
| `tradeoffs` | Compromises we accept + things out of scope | HTML string: `<ul>` — each `<li>` prefixed with `<strong>OUT:</strong>` (out-of-scope) or `<strong>ACCEPT:</strong>` (accepted compromise). |
| `openQuestions` | Things unresolved a teammate should weigh in on | HTML string: bare `<li>` elements (the shell wraps them in `<ul class="risks">`). End each with `…?`. |
| `security` | One-line-per-area decision from the security pass | HTML string: `<table>` with columns *Area*, *Decision*. Use "N/A — <reason>" for areas that didn't apply. |
| `changelog` | Revision history, newest first | Array of `{ ts, note }` objects — see [Changelog](#changelog). |

**HTML strings inside JSON**: escape `<`, `>`, `&` in user-supplied prose, then JSON-escape `"` and `\` when writing the literal. Use the Write tool with proper JSON.

## Changelog

`changelog` is an array of `{ ts, note }`. Newest first. Never delete older entries.

**Initial write** — one entry:

```json
"changelog": [
  { "ts": "2026-05-14 15:30", "note": "Initial draft" }
]
```

**Revision** — read JSON, prepend a new entry, write back:

```json
"changelog": [
  { "ts": "2026-05-14 15:55", "note": "Switched dedup to advisory lock per comment on Decisions" },
  { "ts": "2026-05-14 15:30", "note": "Initial draft" }
]
```

Rules:
- Timestamp: local time, 24-hour, minute-precision, at the moment of the revision.
- Note: one short sentence — what changed *and* why (cite the comment, the new info, or the user request).
- Don't bundle unrelated revisions into one entry; add separate entries so each change is auditable.

## Diagrams

Diagrams are optional — only include one in the `approach` field if a sentence can't convey the behavior. A diagram that mostly restates the paragraph is noise.

Wrap (inside the JSON string for `approach`):

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

Authoring rules:

- **Surfaces, not files.** Participants are roles ("API", "Worker", "Queue") — never file paths or class names.
- **No status codes, no concrete error names.** Label arrows with verbs (`enqueue`, `dispatch`, `retry on failure`), not `POST /v1/dispatch → 422 ALREADY_DONE`. That's spec-writing.
- Prefer one **clear** diagram over three rough ones.
- Keep it under ~12 nodes. If it's bigger, the approach is probably two changes wearing one coat — go back to scope.
- Do NOT use mermaid `click` handlers, embedded HTML, or external image refs — `securityLevel: "strict"` blocks them.

## After writing

Tell the user one short message:
- The URL: `http://localhost:7681/docs/brainstorming/<slug>.html`
- That you're stopping until they review

Do not start spec writing or implementation. Wait for them to come back with "looks good, move on" (or revisions).

## Sharing remotely

When the user wants to share the URL with a teammate (different machine), expose the review server via [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) — no account, random `*.trycloudflare.com` URL per session, no interstitial:

```bash
# one-time install
brew install cloudflared

# expose the review server (run in a separate terminal; Ctrl-C to stop)
cloudflared tunnel --url http://localhost:7681
```

Share the printed `*.trycloudflare.com` URL + the relative path, e.g. `https://random.trycloudflare.com/docs/brainstorming/<slug>.html`.

**Caveat:** the review server has unauthenticated POST endpoints for writing/deleting comments. The URL is unguessable, but anyone who has it can edit. Fine for a focused review session; don't leave a tunnel running unattended. Kill cloudflared (Ctrl-C) when the review is done.
