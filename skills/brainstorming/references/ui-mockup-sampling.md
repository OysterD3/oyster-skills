# UI mockup sampling

When the brainstorm touches new visual surface, hand the user concrete layouts to choose from *before* driving deeper questions — otherwise the rest of the interview shoots at an undefined target. The chosen direction frames everything downstream: which fields appear where, which actions are primary, which states need design.

**Sample when:** new screen, page, dashboard, list, detail view, modal, wizard; major restructure of an existing screen; a new component that lands in multiple places.

**Skip when:** pure backend, schema, infra, refactor, bug fix, or copy/color tweak. If unsure, ask once: *"Is there visual surface here, or is it pure logic?"*

## How

Produce **2–4 directions** that vary along ONE major axis — not random variants. Pick the axis that most shapes the user's tradeoff:

- *Information density*: table vs card grid vs split-pane
- *Flow shape*: wizard vs single form vs inline editing
- *Navigation*: sidebar vs tabs vs breadcrumb stack
- *Primary action surface*: header CTA vs floating action vs row-inline

Each option must include:

- A **name** (1–2 words: "Compact table", "Card grid", "Split-pane")
- An **ASCII preview** ~12 lines × 60 cols showing layout *zones*, not real content. Use box-drawing chars; mark interactive zones (`[btn]`, `▸`/`▾` for expand, `…` for overflow).
- A one-line **best for / tradeoff** tag

Present them in a **single `AskUserQuestion`** call — `header: "Mockup"`, `multiSelect: false` (previews aren't supported for multi-select). Each option's `preview` = the ASCII, `description` = the tradeoff.

After the pick: restate the choice in one sentence, then resume the interview with the chosen layout assumed (subsequent questions frame against it — *"in the split-pane variant, where does bulk-edit live?"*). Record the pick as a **Decisions** row — *Decision: Layout · Picked: split-pane · Rejected: compact table, card grid · Why: deep edit per item with few items in view at a time.*

## Higher-fidelity mockups

ASCII is intentional — brainstorming is read-only and fast. If the user wants pixel-fidelity mockups, that's the `frontend-design` skill's job *after* spec sign-off. Note the deferral in the `tradeoffs` JSON field so it's tracked.

## Example sample set (settings page)

```
Compact table          Card grid              Split-pane
┌──────────────────┐   ┌────┐┌────┐┌────┐    ┌────┬───────────┐
│ filter…   [+ new]│   │name││name││name│    │ ▸  │ name      │
├──┬──────┬────────┤   │role││role││role│    │ ▸  │ email     │
│☐ │ row  │ … │   └────┘└────┘└────┘    │ ▾  │ role  ▾   │
│☐ │ row  │ … │   ┌────┐┌────┐┌────┐    │ ▸  │ ...       │
│☐ │ row  │ … │   │…   ││…   ││…   │    │    │           │
└──┴──────┴────────┘   └────┘└────┘└────┘    │    │  [save]   │
dense; bulk edit       scannable; per-       deep edit;
shines                 item primary action   fewer items
```

(Real previews live inside `AskUserQuestion` option `preview` fields — the table above is just to illustrate "different axes, similar visual budget".)
