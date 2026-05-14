# Shared review-doc shell

Every skill that produces a reviewable HTML artifact (brainstorming, spec-writing, impl-plan-writing, test-review) uses the same data-driven shell pattern:

- `<slug>.html` — static shell (written once per artifact, never edited)
- `<slug>.content.json` — all variable content (this is what revisions edit)
- `<slug>.comments.json` — inline-comment state (managed by the review server)

The shell HTML fetches the content JSON at load, binds the fields into `data-bind` / `data-bind-html` elements, then runs Mermaid, highlight.js, the TOC builder, and the inline-comment system. The shell itself is generated from a tiny per-skill config so each skill stays terse.

## Layout

```
skills/_shared/
  assets/
    shell.css            # all the common styles
    shell.js             # mermaid + hljs + TOC + tag pills + comment system + boot
    shell.tmpl.html  # the template with placeholders
  scripts/
    gen-shell.mjs        # the generator
  README.md              # this file
skills/<skill>/
  shell.config.json      # per-skill config (source of truth)
  assets/
    shell.html           # GENERATED — committed for clarity, but rebuilt from config
    shell.css            # OPTIONAL — skill-specific CSS overrides, loaded after _shared/shell.css
```

The review server (`skills/brainstorming/scripts/review-server.mjs`) serves `/__shell/<skill>/<file>` from `skills/<skill>/assets/<file>`. The `_shared` segment is a valid "skill name" for routing purposes — both `_shared/shell.css` and per-skill extras work the same way.

## Adding a new skill

1. Write `skills/<skill>/shell.config.json`. Schema:

   | Key | Type | Notes |
   |---|---|---|
   | `title` | string | `<title>` tag (also drives the document-title suffix at runtime) |
   | `metaLabel` | string | Shown in the `.meta` strip above the H1 (e.g., "Engineering spec review · 2026-05-14") |
   | `next` | string \| empty | Footer "Next: …" chip; empty hides it |
   | `extras` | string[] | Skill names whose `/__shell/<x>/shell.css` should load AFTER `_shared/shell.css` |
   | `showGoal` | bool (default true) | Whether to emit the `<p class="goal">` line under the H1 |
   | `showChangelog` | bool (default true) | Whether to emit the collapsible changelog block |
   | `sections[]` | array | Section list — see below |

   Each section:

   | Key | Notes |
   |---|---|
   | `id` | Anchor id (kebab-case) |
   | `heading` | H2 text — HTML-escaped already (use `&amp;` for `&`) |
   | `container` | `div` or `ul` (use `ul` when the JSON value is bare `<li>` elements) |
   | `containerClass` | optional class — e.g., `risks`, `ac-list` |
   | `bind` | Content JSON key to inject as `innerHTML` |

2. Run the generator:

   ```
   node skills/_shared/scripts/gen-shell.mjs <skill>
   # or
   node skills/_shared/scripts/gen-shell.mjs --all
   ```

3. Commit `shell.config.json` and the generated `assets/shell.html` together. Re-run after editing the config or `shell.tmpl.html`.

## Editing shared CSS or JS

`_shared/assets/shell.css` and `_shared/assets/shell.js` apply to every shell. No regeneration needed — the shell HTML references them by URL.

If a change is skill-specific (e.g., `.step` cards for impl-plan, `.test-entry` for test-review), put it in `skills/<skill>/assets/shell.css` and list the skill name in the config's `extras` array — the generator will emit the extra `<link>` after `_shared/shell.css`.

## Skill-agnostic JS

`_shared/shell.js` does NOT hardcode any skill name. It:

- derives the content JSON URL from `location.pathname`
- derives the comments URL the same way
- uses `document.title` (from the shell HTML) as the document-title suffix
- discovers sections via `data-bind` / `data-bind-html` attributes

If a skill needs runtime behavior (additional bootstraps, custom section detection beyond `section`/`article.step`/`article.test-entry`), add it as `skills/<skill>/assets/shell.js` and reference it via an additional `<script type="module" src=...>` tag — but the goal is to keep that file empty.
