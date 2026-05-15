---
name: brainstorming
description: Interview the user toward an agreed approach (plus the reasoning behind every load-bearing decision) before any non-trivial change. Triggers on "plan this", "help me plan", "how should we approach", "what's the best way to", and before EnterPlanMode. Researches the codebase first, probes every fork for "why A, not B", runs a security pass, produces a lean HTML review for teammate sign-off.
---

# Brainstorming

A relentless design interview. The output is a concrete **approach** plus the reasoning behind every load-bearing decision — reviewable by a teammate who hasn't opened the repo.

## TL;DR

- **Goal:** drive the user to an agreed approach with `picked / rejected / why` captured for every fork.
- **Output:** one self-contained HTML artifact in `docs/brainstorming/` — no code or file references inside.
- **Flow:** research → propose 2–3 approaches → interview → security pass → sign-off → bake artifact.
- **Hard invariant:** every Decisions row has a non-empty *Why*. Block sign-off otherwise.
- **No code edits.** Only write the artifact JSON; the bake script produces the HTML.

## Operating rules

Non-negotiable.

1. **Research before asking.** Don't ask what a 60-second grep, file read, or doc lookup can answer.
2. **Batch independent; serialize dependent.** 1–4 questions per `AskUserQuestion`. Dependent = A's answer reshapes B → ask A alone. When in doubt, serialize.
3. **Every question surfaces a tradeoff or gotcha.** No-tradeoff questions waste the user's turn — replace with a recommendation and ask for objection.
4. **Every decision has a "why".** Picked + rejected + one-line reason. "Gut feel" → keep probing. Block sign-off if any *Why* is empty.
5. **Challenge initial thoughts reasonably.** Name the weakness, propose the alternative, accept the user's call. One round max — no relitigation.
6. **Security is a dedicated phase.** No sign-off without it.
7. **HTML is approach-only — no code or file references.** Surfaces and roles only ("ingest worker", "auth layer"). Concrete files/types/codes belong in spec-writing.
8. **Keep the HTML lean.** One paragraph max per section. If a teammate would skim past it, cut it.
9. **No implementation during brainstorm.** Read-only. The only writes are the content JSON and the baked HTML (see [references/review-artifact.md](references/review-artifact.md)).

## Workflow checklist

Drive this with TodoWrite — one todo per item. Mark each complete as you go.

- [ ] **Restate the goal in one sentence.** Get the user to confirm before research. Catches misunderstandings cheaply.
- [ ] **Research the codebase.** For a single targeted lookup (known path, one grep) do it inline with `Bash`/`Read`. When the research fans out into independent axes, spawn parallel `Explore` subagents (`model: sonnet`) in a single message — see [references/parallel-research.md](references/parallel-research.md). Note conflicts between the user's framing and what the code actually does. *This research informs your interview — it does not appear in the HTML.*
- [ ] **Research external context if libraries/APIs are involved.** For one library, use `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` inline. For multiple libraries or several unrelated questions about one library, spawn parallel `general-purpose` subagents (`model: sonnet`) — one per topic — and ask each for a ≤200-word brief. Skip both if it's pure internal logic.
- [ ] **Summarize findings (chat only).** 3–6 bullets: what exists, what's missing, what surprised you, conflicts with the user's framing. Surface the riskiest unknown — that's where the interview starts.
- [ ] **Sketch mockup directions (UI only).** If the change introduces new visual surface, propose 2–4 named layout directions with ASCII previews in a single `AskUserQuestion`. The pick frames the rest of the interview *and* becomes a decision row. See [references/ui-mockup-sampling.md](references/ui-mockup-sampling.md). Skip for pure backend/schema/infra/refactor/copy work.
- [ ] **Propose 2–3 distinct approaches and recommend one.** Before any detailed interviewing, name 2–3 structurally different ways to solve this (not stylistic variants). For each: short name, one-line gist, the tradeoff. Lead with a recommendation and the *why* — do not present them as a neutral menu. Use ONE `AskUserQuestion` with the recommendation as option 1 labeled "(Recommended)". The pick frames every later question. See [references/proposing-approaches.md](references/proposing-approaches.md). *If the change is UI-heavy and the mockup pick already determined the system-design approach, record that pick as the chosen approach and skip — don't ask twice.*
- [ ] **Interview loop.** *Inside* the chosen approach. Batch independent questions, serialize dependent ones (rule #2). Continue until the plan answers: *context, runtime behavior of the chosen approach, load-bearing decisions + why each was picked, compromises accepted, out of scope, unresolved.* See [references/question-patterns.md](references/question-patterns.md).
- [ ] **Probe every decision for "why".** As decisions surface during the interview, log each one with `picked / rejected / why`. If a "why" is "user said so" or "gut feel", probe — ask for the underlying reason (perf, simplicity, lock-in concern, team familiarity, deadline pressure). A teammate reviewing the HTML wants the reason, not the verdict.
- [ ] **Challenge details within the chosen approach** if a credible weakness surfaces during the interview (perf, security, simpler internal mechanism). The big-fork challenge already happened at proposal time; this is for finer-grained issues. If the user holds firm, record their reason in the "why" column — that's the context a reviewer wants.
- [ ] **Security pass.** Two steps, in order:
  1. **Threat-model the feature first.** Before any checklist, name 1–3 threats *unique to this feature's surface* — examples: "LLM prompt injection because we forward user text to a model and then run tools on the output", "replay attacks because we issue JWTs without `jti`", "RLS bypass because the new endpoint hits the DB with a service-role key". The generic list won't catch these.
  2. **Walk the checklist as a backstop.** Read [references/security-checklist.md](references/security-checklist.md) — walk the always-applicable sections, then any conditional sub-checklists triggered by the feature (LLM, cryptographic operations, etc.).

  Output is one-line *Area · Decision* pairs; **no file paths or code references**. Mandatory — do not skip even when the change "feels" non-security.
- [ ] **Synthesize the approach in chat.** Format: *Goal · Context · Approaches considered · Approach (chosen one in detail) · Decisions (Decision/Picked/Rejected/Why) · Tradeoffs · Open questions · Security*. Keep iterating with the user until they signal agreement. Talk in surfaces, not files.
- [ ] **Verify "why" completeness.** Before offering sign-off, check every Decisions row has a non-empty *Why* (reviewable — a teammate could agree or push back). If any row is thin, loop back for that one decision.
- [ ] **Offer the optional roast.** Ask: "Want me to roast this plan before sign-off? An adversarial pass over the whole plan, or just focus on one area (security / ops cost / simpler alternative)? Or skip." If they pick a focused angle, pass it to `roast-me` as scope. Surface its verdict, fold any worthwhile concerns into a brief revision pass. Skipping is fine — this is opt-in.
- [ ] **Explicit sign-off in chat.** Ask: "Ready for me to write the review doc, or anything to revise first?" Wait for a clear yes.
- [ ] **Write the review artifact.** Write the content JSON, then run the bake script to produce a self-contained HTML — see [references/review-artifact.md](references/review-artifact.md). This is a hard checkpoint — the user must review before spec writing begins.
- [ ] **Ensure `docs/` is gitignored** (one-time per project). If `.gitignore` doesn't list `docs/`, surface this to the user in one sentence: "Tip: add `docs/` to your `.gitignore` so brainstorming/spec/plan artifacts and inline-comment JSON files stay local." Do not auto-edit `.gitignore`.
- [ ] **Start the review server** — only required for inline comments. The artifact HTML opens standalone in any browser (CSS/JS are baked in). Inline comments POST to `localhost:7681`; without the server they're disabled (a banner appears). See [Review server lifecycle](#review-server-lifecycle).
- [ ] **Stop and hand off.** Tell the user the URL (`http://localhost:7681/docs/brainstorming/<file>.html`) or the local file path — both work. Do not start spec writing or implementation until they return with "looks good, move on" (or revisions). For comment revisions, see [references/inline-comments.md](references/inline-comments.md).
- [ ] **Shut the review server down** when the user is moving on or approves the plan. See [Review server lifecycle](#review-server-lifecycle).

## Review server lifecycle

The brainstorming artifact opens directly (CSS/JS baked in) — the review server is only needed for inline comments. Canonical lifecycle docs (launch, shutdown, cloudflared sharing) live in [_shared/references/review-server.md](../_shared/references/review-server.md).

## Anti-patterns

| Don't | Do |
|---|---|
| "What do you think about X?" (no tradeoff) | "X vs Y — X is simpler, Y handles concurrent writes. Is concurrency a real concern here?" |
| Batch dependent questions in one turn | Ask the upstream one first — the answer will reshape the rest. Independent axes are fine to batch up to 4 at a time. |
| Accept "let's just do it the simple way" without naming what gets deferred | "OK — simple way means no idempotency key. If the worker retries we'll double-send. Acceptable for now? I'll log that tradeoff." |
| Record a decision with empty or vague "why" ("user picked it", "gut feel") | Probe for the underlying reason. If after probing the only honest "why" is "we don't know yet", surface that as an Open question instead of a Decision. |
| Reference file paths, function names, or types in the HTML | Talk in surfaces and roles ("ingest worker", "auth layer"). Concrete files/types live in spec-writing. |
| Long prose sections in the HTML | One paragraph max per section. A reviewer skims; lean wins. |
| Skip security because "it's just a UI change" | UI changes touch input handling, authz, CSRF surface. Run the pass. |
| Scatter scratch plans across random files | Iterate in chat. The ONE permitted artifact is the final review doc — written only after sign-off, only to `<cwd>/docs/brainstorming/`. |

## When to exit early

Exit before completing the checklist only if:

- User says "skip the interview, just do X" — still run security pass if the change touches auth/secrets/user-input/PII; still produce the artifact unless user also says "skip the review doc".
- Research reveals the task is a pure lookup or trivial fix and the user agrees mid-stream — no artifact needed.

State explicitly that you're exiting brainstorm and why.
