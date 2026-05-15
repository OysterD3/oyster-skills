# Slide spec

The pptx skill consumes this spec to build the deck. Substitute the bracketed `<placeholders>` with values parsed from the brainstorming content JSON, then pass the entire spec as the prompt to `pptx`.

## Output

- File: `docs/brainstorming/<slug>.pptx`
- Layout: 16:9 (10" × 5.625")
- Slide count: 5 (one title + four topic slides)

## Palette

| Token | Hex | Use |
|---|---|---|
| navy | `#1A2761` | Headlines, accent rail, dark panel, picked-option card |
| teal | `#0F9FA4` | Topic labels, category headers, accent underline |
| amber | `#E89B2C` | Check circles, picked accents, warning triangles |
| cream | `#FAF9F6` | Slide background |
| body | `#5B6470` | Secondary text on light backgrounds |
| rule | `#D8DCE3` | Card borders, dividers |
| danger | `#991B1B` | "REJECTED" pill text |
| white | `#FFFFFF` | Text on dark panels |

## Typography

- **Headlines:** Georgia (universal serif), bold.
- **Labels:** Calibri, bold, rendered as uppercase with 3–4pt character spacing.
- **Body:** Calibri, regular.

Use these specific names — they're guaranteed available on every machine.

## Shared elements

**Topic header** (slides 2–5, top of slide):

- Label `TOPIC <N>  •  <TOPIC-LABEL>` — Calibri bold 11pt teal, 4pt char spacing, at x=0.6", y=0.42", w=9.2".
- Headline below — Georgia bold 36pt navy, at x=0.6", y=0.85", w=9.2".

**Footer** (slides 2–5, bottom):

- Thin rule across the slide at y=5.20", w=8.8", color rule (#D8DCE3), 0.5pt.
- `STAKEHOLDER BRIEFING  •  <date>` — left at x=0.6", y=5.30", Calibri 9pt body, 3pt char spacing.
- `<slide-num> / <total>` — right at x=7.5", y=5.30", Calibri 9pt body.

## Slide 1 — Title

- Background: cream. No topic header, no footer.
- Left rail: 0.3" wide navy rectangle, full slide height (5.625").
- Label at x=0.8", y=1.45", w=8.5", h=0.35": `STAKEHOLDER BRIEFING  •  <date>`, Calibri bold 12pt teal, 4pt char spacing.
- Title at x=0.8", y=1.9", w=8.5", h=1.6": `<content.title>`, Georgia bold 50pt navy.
- Teal underline at x=0.8", y=3.65", w=1.2", h=0, color teal, 1.5pt.
- Subtitle at x=0.8", y=3.85", w=8.5", h=1.1": `<deckSubtitle or first sentence of goal, ≤140 chars>`, Calibri 16pt body.

## Slide 2 — Why

- Topic header: `TOPIC 1` / `WHY` / headline `Why we're doing this`.
- Body items: up to 5 from `content.context` (parse `<li>` elements).
- Each row at startY=2.05", height 0.55", gap 0.07".
- Navy oval bullet (0.18" × 0.18") at x=0.6", vertically centered in row.
- Item text at x=0.95", w=8.45", Calibri 14pt navy, vertically centered in row.
- Footer (slide 2 of 5).

## Slide 3 — Approach + Payoffs

Two-column layout.

- Topic header: `TOPIC 2` / `HOW` / headline `The approach + what it solves`.

**Left column** (cream background, x: 0.6"–4.95"):

- Label at x=0.6", y=2.05", w=4.5", h=0.3": `WHAT WE'RE BUILDING`, Calibri bold 10pt teal, 3pt char spacing.
- Up to 5 items from `content.approach` (parse `<li>`).
- Each row at startY=2.45", height 0.55".
- Navy filled circle (0.18" × 0.18") at x=0.6", y=row+0.18", as a bullet (no bulb icon needed — keep it simple).
- Item text at x=1.05", w=3.85", Calibri bold 11.5pt navy.

**Right panel** (navy background):

- Filled navy rectangle at x=5.15", y=1.95", w=4.25", h=3.15".
- Label at x=5.50", y=2.25", w=3.55", h=0.3": `WHY IT SOLVES OUR PROBLEMS`, Calibri bold 10pt amber, 3pt char spacing.
- Headline at x=5.50", y=2.57", w=3.55", h=0.6": `Each problem, addressed`, Georgia bold 18pt white.
- Up to 4 payoff items from `content.payoffs` — see Fallback rules below.
- Each row at startY=3.25", height 0.46".
- Amber filled circle (0.3" × 0.3") at x=5.50", y=row+0.04".
- White checkmark glyph "✓" centered in the amber circle (or a small white check shape).
- Item text at x=5.93", w=3.12", Calibri 11pt white, vertically centered.

Footer (slide 3 of 5).

## Slide 4 — Approaches Considered

- Topic header: `TOPIC 3` / `OPTIONS` / headline `How we considered solving it`.
- 3 horizontal cards. Card dimensions: 2.85" × 2.95". Layout: startX=0.6", startY=2.0", gap=0.125".
- Card positions: x = 0.6", 3.575", 6.55".
- From `content.approachesConsidered`, parse the `<tbody>` rows (up to 3). Each row has 4 cells: approach, gist, tradeoff, status.
- Detect the picked row via `class="picked"` on the `<tr>` element.

**Picked card** (navy):

- Fill navy, no border.
- Amber accent strip at the very top: x=card-x, y=card-y, w=card-w, h=0.08", color amber, no line.
- Pill label at x=card-x+0.25", y=card-y+0.22", w=card-w-0.5", h=0.3": `PICKED`, Calibri bold 10pt amber, 3pt char spacing.
- Approach name at x=card-x+0.25", y=card-y+0.55", w=card-w-0.5", h=0.95": Georgia bold 17pt white.
- Horizontal rule at y=card-y+1.55", w=card-w-0.5", color amber, 0.5pt.
- Gist text at x=card-x+0.25", y=card-y+1.65", w=card-w-0.5", h=card-h-1.8": Calibri 11pt white.

**Rejected cards** (white):

- Fill white, 0.5pt rule border (color rule).
- Pill label at same position: `REJECTED`, Calibri bold 10pt danger.
- Approach name: Georgia bold 17pt navy.
- Horizontal rule color rule.
- Gist text: Calibri 11pt body.

Footer (slide 4 of 5).

## Slide 5 — Trade-offs

- Topic header: `TOPIC 4` / `TRADE-OFFS` / headline `What we're trading off`.
- Body items: up to 5 from `content.tradeoffs` (parse `<li>`).
- Each row at startY=2.05", height 0.58", gap 0.07".
- Amber warning triangle (▲) at x=0.6", y=row+0.12", w=0.32", h=0.32" — either as a filled triangle shape (color amber) or a Unicode glyph styled large in amber.
- Item text at x=1.05", w=8.35", Calibri 13pt navy, vertically centered.

Footer (slide 5 of 5).

## Fallback rules

- **`content.payoffs` absent or empty:** do NOT duplicate context items into the right panel. Render the navy panel on slide 3 with just the label + headline ("Each problem, addressed") and skip the item list. The left column carries the substance; the panel acts as a visual anchor.
- **Section has more items than the cap** (5 for body slides, 3 for the options cards): keep the first N, drop the rest, and warn the user in your reply that items were truncated.
- **`content.title` empty:** stop. Title is required — surface the error and ask the user to add it to the JSON.
- **`content.context`, `content.approach`, `content.approachesConsidered`, or `content.tradeoffs` empty:** skip that slide and reduce the total slide count accordingly. Update the footer's `<total>` to match. Warn the user in your reply.

## HTML-to-plain conversion

The content JSON stores HTML strings. Before substituting into this spec, convert to plain text:

- Parse list items via `<li[^>]*>(.+?)</li>` (case-insensitive, dotall).
- Parse table rows via `<tr[^>]*>(.+?)</tr>` and cells via `<td[^>]*>(.+?)</td>`.
- For row class detection: `class\s*=\s*["'][^"']*\bpicked\b`.
- Strip remaining tags: `<[^>]+>` → ``.
- Decode entities: `&amp;` → `&`, `&lt;` → `<`, `&gt;` → `>`, `&quot;` → `"`, `&#39;` → `'`, `&nbsp;` → ` `, `&mdash;` → `—`, `&ndash;` → `–`.
- Collapse whitespace: `\s+` → ` `, then trim.
