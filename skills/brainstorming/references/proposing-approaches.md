# Proposing approaches

This is the biggest fork in the brainstorm. Surface alternatives *before* drilling into details — otherwise the rest of the interview shoots at an approach that was never weighed against anything.

## Principles

1. **Distinct, not stylistic.** Approaches must differ in a *structural* way — sync vs async, monolith change vs new service, push vs pull, polling vs webhook, denormalized vs computed, single migration vs phased rollout. "With retries vs without retries" is a Decision row, not an approach. If you can't honestly find 2 structurally distinct options, surface that to the user: *"I only see one credible approach here — X — because <reason>. Want me to explore further, or proceed?"* Don't manufacture a fake alternative to fill the slot.
2. **Recommend with conviction.** "Here are options, what do you think?" wastes the user's turn. Lead with a recommendation and the *why*. The user is free to overrule; you're free to push back once if they pick something the research suggests is worse.
3. **Name the tradeoff for every option.** Each approach has a cost. State it — that's what makes the choice reviewable later.
4. **Internal-research-first.** Use the codebase research from the previous step. If the codebase already has a pattern that fits, that's usually the recommendation; the alternative is "introduce a new pattern because <reason>".

## How

Use ONE `AskUserQuestion` call with `multiSelect: false`:

- `header`: "Approach"
- 2–3 options. **Option 1 is the recommendation** — its `label` ends with `(Recommended)` and its `description` leads with *why* you recommend it, then names the tradeoff.
- Other options: `label` is the approach name, `description` is the gist + the tradeoff.

Example:

```
Approach
├─ Push-based dispatch (Recommended)
│   Reuses the existing webhook + retry-queue pattern; lowest new surface area.
│   Tradeoff: per-message ops cost vs. lower latency.
├─ Pull-based polling
│   Worker polls source every N seconds and batches.
│   Tradeoff: simpler ops vs. multi-minute latency.
└─ Hybrid (push with poll-recovery)
   Push for live events, poll to backfill on push-receiver downtime.
   Tradeoff: most resilient vs. double the moving parts.
```

After the pick: restate the choice and the user's stated reason in chat (one sentence each). This becomes the **Approaches considered** section in the HTML — all 2–3 options, the picked one marked with the reason it won, the rejected ones marked with the reason they didn't.

## Anti-patterns

| Don't | Do |
|---|---|
| Present 3 variants of the same approach ("with cache / without cache / with cache+TTL") | Find a *structural* alternative. Cache configuration is a Decision row, not an approach. |
| Be neutral ("which do you prefer?") | Recommend. Be wrong sometimes; that's fine. A wrong-but-reasoned recommendation produces a better interview than a non-committal menu. |
| Hide the tradeoff to make the recommendation look obvious | Name the cost of the recommendation explicitly. A teammate reviewing the HTML needs to see why a credible alternative was rejected. |
| Skip this step because "the user already said what they want" | If the user proposed one approach and you found a credibly better one during research, this is the moment to surface it. Their stated approach becomes one of the options. |
