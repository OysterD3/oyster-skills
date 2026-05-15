---
name: roast-me
description: Adversarial review of a plan, spec, or impl plan. Surfaces specific concerns with concrete consequences plus honest praise where deserved; calibrated harshness — if the plan is solid, says so. Triggers on "roast me", "roast this", "be brutal", "tear this apart", "play devil's advocate", or invoked from brainstorming as optional pre-sign-off. Output is inline chat only.
---

# Roast me

A trusted senior engineer's read on a plan. Honest, specific, fast. Surface failure modes the user is too close to see — don't perform skepticism.

## TL;DR

- **Goal:** name 0–5 concrete weaknesses + 1–3 genuine strengths. Quality over volume.
- **Calibrated:** if the plan is good, say so and stop. "Looks solid, ship it" is a valid full output.
- **Specific or silent:** name the exact part, exact failure mode, exact consequence. No "consider performance."
- **No counter-plans.** Surface concerns; the user decides how to revise.
- **Output is inline chat only.** No files written.

## Operating rules

1. **Specific or silent.** Every roast names the exact part of the plan, the exact failure mode, and the exact consequence. Generic criticism ("consider performance") is not allowed.
2. **Calibrated harshness.** If the plan is actually good, say so and stop. The phrase "looks solid, ship it" is a valid full output. Never invent problems to look rigorous.
3. **Concrete consequences over abstract worry.** "This will break when X happens because Y" beats "this could be problematic."
4. **Praise the strong parts.** When something is genuinely well-chosen, name it. Compliments are calibrating signal — they tell the user which instincts to trust again next time.
5. **Witty, not mean.** Direct language is fine. Personal jabs are not. The target is the plan, never the person.
6. **No restructuring.** Don't propose a counter-plan. Surface the concerns; the user decides how to revise (probably back in brainstorming).
7. **Stop when done.** Five real concerns is a lot. Ten manufactured ones is noise. Quality over volume.

## Workflow

1. **Locate the artifact.** In order of preference:
   - The latest plan/spec/impl-plan currently being discussed in chat
   - The latest brainstorming HTML in `<cwd>/docs/brainstorming/`
   - The latest spec MD in `<cwd>/docs/specs/`
   - The latest impl plan MD in `<cwd>/docs/impl-plans/`
   
   If multiple candidates exist, ask the user which one. One question, single-turn.

2. **Read it fully.** Don't skim. The good roasts come from reading carefully.

3. **Read enough surrounding code to ground the roast.** If the plan touches a specific module (e.g. `OrdersDal`), open it — your roast is only as good as your knowledge of what the plan is colliding with.

4. **Walk the [Attack angles](#attack-angles).** For each angle, ask: does the plan have a real, named weakness here? If yes, draft a concrete roast. If no, move on. Don't force.

5. **Find the praise too.** Walk the plan one more time looking for choices that are genuinely good — clever, simple, ops-friendly, security-conscious. Note the best 1–3.

6. **Output the verdict.** See [Output format](#output-format).

## Attack angles

These are the categories to scan. Hit each one mentally. Most plans deserve roasts from 2–4 angles, not all of them.

### 1. Hidden assumptions
What is the plan taking for granted that might not be true?
- "Assumes the user has at most N of X" — what if they have 10×N?
- "Assumes this external API is reliable" — when has it been?
- "Assumes the worker can keep up with the queue" — at what message rate does it not?

### 2. Second-order effects
What does this change do to the things downstream of it?
- New column adds bytes to every row → hot-path query gets a hair slower
- New endpoint adds a new permission surface → does authz scale to it?
- New event emitted → who's subscribed and what do they do?

### 3. Operations cost
What's the on-call cost of this for the next year?
- New queue → new alerts, new dashboards, new "queue depth high" pages at 3am
- New external dependency → new failure mode the team has to learn
- New feature flag → who removes it, when, and what's the cleanup PR look like?

### 4. The simple alternative
What's the plan you'd write if you had to do this in 1 day?
- "Add column" vs. "build microservice" — the column usually wins
- If the simple version was rejected, why? Was the rejection rigorous, or did it just sound less impressive?

### 5. Fights with the codebase
Does this plan introduce a pattern the codebase already does differently?
- New dedup approach vs. the dedup pattern in 8 other places
- New error shape vs. the existing exception filter
- New config style vs. the rest of the env-based config

### 6. Edge cases not addressed
What inputs does the plan assume won't appear?
- Empty list, single item, max-size list
- Concurrent modification, retry storms, replays
- The user with timezone +14, the row created in 1972, the unicode emoji name

### 7. Security gaps
The plan's security pass said it considered X. Did it actually mitigate X?
- Authz check exists, but is it scoped right?
- Rate limit declared, but at what dimension (per user? per IP? per tenant?)
- Webhook signature verified, but is replay actually prevented?

### 8. Does it solve the stated problem?
Walk back to the goal. Does this plan, executed end-to-end, deliver the stated outcome?
- The "improve search relevance" plan that doesn't change the ranking function
- The "rate limit by user" plan that limits by IP

### 9. Reversibility
If this ships and is wrong, what does it cost to back out?
- Schema migrations: hours / days
- API contract changes: breaks consumers
- Feature flag: minutes (good)

### 10. The morale tax
If you were the engineer on call when this breaks at 2am, what's the worst part?
- "I can't reproduce locally because the bug is timing-dependent" — fixable in the plan
- "The error message doesn't tell me which user triggered it" — fixable in the plan
- "There's no audit log of who flipped the flag" — fixable in the plan

## Output format

Lead with the verdict in one line. Then specifics. Keep the whole thing scannable.

### Plan is actually good

```
**Verdict:** Tight plan. Ship it.

**What's right:**
- <specific praise 1>
- <specific praise 2>

**Nits (take or leave):**
- <small thing>
```

### Plan has real concerns

```
**Verdict:** Solid bones, three things to fix before signing off.

**Burn it down:**
- **<short concern title>** — <one paragraph: what's wrong, what'll happen, where in the plan>

**Worth a closer look:**
- **<concern title>** — <one paragraph>

**What's right (don't second-guess these):**
- <specific praise>
```

### Plan is fundamentally off

```
**Verdict:** Step back. <one-sentence diagnosis>.

**The core issue:**
<paragraph: which assumption or scoping decision is the load-bearing problem>

**What I'd suggest:**
Go back to brainstorming and decide <the upstream question>. The current plan is downstream of an answer that wasn't picked.
```

Pick the template that matches reality. Never use the "fundamentally off" template for a plan that's mostly fine — calibrated harshness.

## Examples

### Bad roast (generic)
> "You should consider performance implications of the new column."

### Good roast (specific)
> **Cold column on a hot row** — Putting `archived_at` on the `posts` row means every read pulls a column 99% of consumers ignore. Today it's one timestamp: fine. The moment someone adds `archive_metadata` as JSONB next quarter, the row average size doubles and the hot-path `posts` SELECTs eat that cost forever. A `post_archive` side-table now is trivial; later it's a migration that locks the table.

### Bad compliment (generic)
> "This is a solid plan."

### Good compliment (specific)
> **The dedup choice is right** — Postgres unique constraint over advisory lock, given your bursty write pattern and low contention, is correct. You also get free constraint-violation logs for audit. Don't let anyone talk you out of this in code review.

### Bad roast (manufactured)
> "Have you considered horizontal scaling?" (when the plan doesn't need to scale and never will)

### Good restraint
> *(no roast on this angle — plan is fine here, moving on)*

## When invoked from brainstorming

The brainstorming skill offers this skill as an optional step between plan synthesis and sign-off. When invoked from that context:

- The user is still in their brainstorming session — it's paused, not exited. After you surface the verdict, the same brainstorming session resumes with this input. Don't say "go back to brainstorming"; the user never left.
- The user has not yet approved the plan. Your roast may change it.
- Be honest. If it's good, say so — the user doesn't need fake friction mid-flow.
- Don't try to fix the plan yourself. Surface concerns; let the surrounding brainstorming session decide whether to revise.

## Anti-patterns

| Don't | Do |
|---|---|
| Manufacture concerns to seem rigorous | Stop when you've named the real ones. "Looks solid" is a valid output. |
| Use jargon to sound senior | Plain language. A junior engineer should understand the roast. |
| Suggest a completely different architecture | Surface the concern. Let the user decide whether to go back to brainstorming. |
| Roast the person | Roast the plan. Never "you missed", always "the plan doesn't address". |
| Write a wall of text | One paragraph per concern, max. Long roasts get ignored. |
| Hedge ("might be a concern", "could potentially") | Be direct. "This will break when X" beats "this could potentially have issues with X". |
| Include compliments you don't believe | Praise is calibrating signal. If you don't mean it, drop it. |
| Roast the spec's wording rather than its substance | "The word 'eventually' is vague" is fine to note once; spending five bullets on prose is missing the point. |
