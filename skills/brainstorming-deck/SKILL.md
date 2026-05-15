---
name: brainstorming-deck
description: Generate a polished 5-slide stakeholder PowerPoint (.pptx) from a brainstorming-skill content JSON (or its sibling HTML). Adopts a navy + teal + amber palette with serif headlines and a "techniques + why it pays off" two-column pattern. Trigger when the user says "make a deck", "turn this brainstorm into slides", "pptx for the leads", "convert the HTML to pptx", or references a `docs/brainstorming/*.html` / `*.content.json` and wants slides for stakeholders.
---

# Brainstorming Deck

Turns a brainstorming-skill content JSON into a 5-slide stakeholder PowerPoint deck.

## When to use this skill

The user has a finished (or near-finished) brainstorming artifact in `docs/brainstorming/` and wants a leadership-friendly deck to walk through it. Use this skill *after* the brainstorm is signed off — it's a presentation layer, not a decision tool.

Do NOT use this skill to design a deck from scratch — its job is to bake an existing brainstorming JSON. If the brainstorming content doesn't exist yet, send the user to the `brainstorming` skill first.

## Inputs

Either of:

- `docs/brainstorming/<slug>.content.json` — the source of truth (preferred).
- `docs/brainstorming/<slug>.html` — the skill reads the sibling `<slug>.content.json`. If it doesn't exist, error and tell the user.

## Output

A self-contained `.pptx` at `docs/brainstorming/<slug>.pptx`, next to the source. Opens in PowerPoint / Keynote / Google Slides directly — no fonts to install, no server needed.

## Slide structure

Five slides, in order. Content comes verbatim from the JSON — this skill does not invent new content.

| # | Slide | Source field(s) | Layout |
|---|---|---|---|
| 1 | Title | `title`, `goal` or `deckSubtitle`, `date` | Cream background, navy accent rail on the left, large serif title, teal "STAKEHOLDER BRIEFING · &lt;date&gt;" label. |
| 2 | Why | `context` | Topic label + serif headline. List of context items as a single column, with navy bullet markers. |
| 3 | Approach + Payoffs | `approach`, `payoffs` (optional, falls back to `context`) | Two-column. **Left**: approach bullets under a "WHAT WE'RE BUILDING" teal label, with navy bulb icons. **Right** (navy panel): "WHY IT SOLVES OUR PROBLEMS" amber label + serif white head + amber-circle checkmark items. This is the slide that most closely matches the visual reference. |
| 4 | Approaches Considered | `approachesConsidered` | Three cards horizontal. Picked row (matched by `class="picked"`) is rendered as a solid navy card with amber accents; rejected rows are white with a thin border and red verdict pill. |
| 5 | Trade-offs | `tradeoffs` | Topic label + serif headline. List of tradeoff items with amber warning triangles. |

If a section has more items than the slide can fit (typically 5), the extra items are dropped silently — flag this to the user in your reply and suggest they trim the JSON.

## Optional JSON fields

Two fields tune the deck without changing the brainstorming HTML output:

- `deckSubtitle` (string) — overrides the title-slide subtitle. Defaults to the first sentence of `goal`, truncated to ~120 chars.
- `payoffs` (array of `{title, body}` or array of strings) — drives the navy-panel right column on slide 3. Defaults to `context` items verbatim.

Both are ignored by the brainstorming HTML bake (the brainstorming `shell.config.json` doesn't bind them), so they exist only for the deck.

## Workflow

1. **Resolve the input** to an absolute `*.content.json` path. If the user passed a `.html`, look for the sibling `.content.json`. If neither exists, ask the user for the path.
2. **Ensure deps**: check that `scripts/node_modules/` exists. If not, run from the skill scripts dir:
   ```bash
   pnpm install --silent
   ```
   First run takes ~10 seconds; subsequent runs reuse the install.
3. **Bake** the deck:
   ```bash
   node /Users/oysterlee/.claude/skills/brainstorming-deck/scripts/build-deck.mjs \
     <abs-path-to-content.json> [<abs-path-to-output.pptx>]
   ```
   If `output.pptx` is omitted, the script writes to the same directory and slug, replacing `.content.json` with `.pptx`.
4. **Report** the output path to the user. Do not auto-open.

## What this skill does NOT do

- Visual QA via LibreOffice rendering — the pptx skill recommends it but most machines won't have soffice installed. Spot-check by extracting text with `python3 -m markitdown <file>.pptx` if you want a content-only sanity check.
- Edit existing decks — this skill always re-bakes from the JSON. If the user wants manual edits, they should do them in their slide tool of choice.
- Generate decks for non-brainstorming artifacts (e.g. spec docs, plan docs). The schema is brainstorming-specific.

## Visual language

Palette (defined as constants near the top of `scripts/build-deck.mjs`):

| Token | Hex | Used for |
|---|---|---|
| `navy` | `#1A2761` | Headlines, dark-panel background, accent rail |
| `teal` | `#0F9FA4` | Topic labels, category headers |
| `amber` | `#E89B2C` | Checkmark circles, picked-card accents, warning icons |
| `cream` | `#FAF9F6` | Slide background |
| `ink` | `#1A2761` | Primary text on light backgrounds |
| `body` | `#5B6470` | Secondary / supporting body copy |
| `rule` | `#D8DCE3` | Card borders, dividers |
| `white` | `#FFFFFF` | Text on dark panels |

Typography:

| Slot | Default | Better-if-installed |
|---|---|---|
| Headlines | `Georgia` (universal serif) | `Playfair Display` |
| Labels | `Calibri` | `Inter` |
| Body | `Calibri` | `Inter` |

The defaults are deliberate — universally available, no font-substitution surprises when the deck opens on a different machine. To use the upgraded fonts, edit the `FONT_HEAD` / `FONT_LABEL` / `FONT_BODY` constants at the top of `scripts/build-deck.mjs`.

See `references/design.md` for the visual reference image and the rationale behind each layout choice.
