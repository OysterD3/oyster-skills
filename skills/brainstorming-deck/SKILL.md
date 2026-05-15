---
name: brainstorming-deck
description: Generate a 5-slide stakeholder PowerPoint from a brainstorming-skill content JSON by delegating to Anthropic's `pptx` skill. This skill extracts the content + supplies a detailed slide spec; pptx renders the file. Requires the `pptx` skill to be installed. Trigger when the user says "make a deck", "turn this brainstorm into slides", "pptx for the leads", "convert the HTML to pptx", or references a `docs/brainstorming/*.html` / `*.content.json` and wants slides for stakeholders.
---

# Brainstorming Deck

Generate a 5-slide stakeholder deck from a brainstorming content JSON. This skill is a thin wrapper: it extracts the content + hands a detailed layout spec to the `pptx` skill, which writes the file.

## TL;DR

- **Input:** `docs/brainstorming/<slug>.content.json` (or sibling `.html` — find the .content.json).
- **Output:** `docs/brainstorming/<slug>.pptx`, alongside the source.
- **5 slides:** Title · Why · Approach + Payoffs · Approaches Considered · Trade-offs.
- **Generation:** delegated to the `pptx` skill. This skill never writes .pptx itself.
- **Requires:** the `pptx` skill must be available — see [Pre-flight](#pre-flight).
- **Visual language:** navy + teal + amber, serif headlines. [references/design.md](references/design.md) for the rationale; [references/slide-spec.md](references/slide-spec.md) for the layout contract.

## Pre-flight

Before anything else, scan the available-skills list (provided in system reminders) for a skill named `pptx`. If it's not present, **stop** and tell the user:

> The `pptx` skill isn't installed in this environment. I'd need it to generate the deck. Install it via the appropriate skills mechanism for your harness and re-run, or generate the deck manually using your slide tool of choice.

Don't try to fall back to manual pptx generation — that's exactly what's delegated to `pptx`.

## Workflow

1. **Resolve the input path** to a `*.content.json` file. If passed a `.html`, find the sibling `.content.json`. If neither exists, ask the user.
2. **Parse the JSON.** Extract: `title`, `date`, `goal`, `deckSubtitle` (optional), `context`, `approach`, `approachesConsidered`, `tradeoffs`, `payoffs` (optional).
3. **HTML-to-plain** for each section. Conversion rules in [references/slide-spec.md](references/slide-spec.md#html-to-plain-conversion).
4. **Identify the picked approach** in `approachesConsidered` by detecting `class="picked"` on the `<tr>`.
5. **Build the prompt** by reading [references/slide-spec.md](references/slide-spec.md) and substituting parsed values into the bracketed placeholders. Include the output path explicitly: `Write the deck to <absolute-path>/<slug>.pptx`.
6. **Invoke the `pptx` skill** via the Skill tool with the filled spec as `args`.
7. **Verify** the .pptx exists at the expected path. If it doesn't, surface the pptx skill's error to the user.
8. **Report** the output path. Do not auto-open.

## Optional JSON fields

These exist in the content JSON only for the deck (the brainstorming HTML bake ignores them):

- `deckSubtitle` (string) — overrides the title-slide subtitle. Defaults to the first sentence of `goal`, truncated to ~140 chars.
- `payoffs` (string[] or `{title, body}[]`) — populates the navy panel on slide 3. If absent, the panel renders without an item list — the left column carries the substance (see [Fallback rules](references/slide-spec.md#fallback-rules)).

## When NOT to use

- The user hasn't run brainstorming yet (no content JSON) — point them at the `brainstorming` skill first.
- The user wants to edit an existing deck — re-bake from JSON, or do manual edits in their slide tool.
- The user wants a deck for a spec / impl-plan / test-review artifact — the schema is brainstorming-specific.

## Anti-patterns

| Don't | Do |
|---|---|
| Write a custom .pptx generator script | Delegate to the `pptx` skill — that's the entire point of this skill. |
| Skip the pre-flight check and try to "just generate" | Stop and tell the user the `pptx` skill is missing. They install it; you don't fake it. |
| Auto-open the .pptx after generation | Report the path; user opens it. |
| Re-bake without re-reading the spec | The slide spec is the contract — read it fresh, fill it in, hand it over. Don't paraphrase from memory. |
| Use this skill on spec / plan / test-review artifacts | Schema is brainstorming-specific. Other artifacts need their own deck skills. |
