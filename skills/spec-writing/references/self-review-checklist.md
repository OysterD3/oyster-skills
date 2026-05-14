# Spec self-review

Run AFTER drafting the spec and BEFORE rendering the HTML. Two passes. Both must come back clean (all ✓). Any ⚠ or ✗ means stop, fix the spec, re-run.

## How to use

1. Have the brainstorming HTML and the draft spec loaded in your working context.
2. Walk both tables below, item by item, and mark ✓ / ⚠ / ✗ with a one-line note for non-✓ items.
3. Output the result in chat as a short table — the user benefits from seeing the rigor.
4. If any item is non-✓: amend the spec, then re-run only the items that could be affected by the amendment.
5. When all items pass, proceed to render HTML.

## Pass 1 — Alignment (spec ↔ brainstorming)

Brainstorming is the source of truth for the **approach** — what to do and why. The spec adds the implementation contract on top. The spec must not silently drop, contradict, or re-litigate the brainstorming, but it WILL add files/types/codes that brainstorming intentionally did not specify.

| # | Check | What to look for |
|---|---|---|
| 1 | Goal | Spec **Goal** matches brainstorming **Goal** semantically. Tightened wording is OK; new scope is not. |
| 2 | Context preserved | The "why now" framing from brainstorming **Context** is visible somewhere in the spec (Goal preamble or Implementation notes opening). Not lost. |
| 3 | Approach selection preserved | Brainstorming **Approaches considered** — the picked option, its winning reason, and the rejected alternatives — appears as a one-paragraph "approach selection" note in spec **Implementation notes**. Don't drop the rejected options; a reviewer needs to see that alternatives were weighed. |
| 4 | Approach honored | Spec **Behavior** reflects the brainstorming **Approach**. If brainstorming included a diagram, the spec's diagram is a refinement, not a contradiction. |
| 5 | Decisions honored — picks | Every brainstorming **Decisions** row's *Picked* option is reflected in the spec wherever the decision applies (contracts, data model, error handling, rollout, security). No decision silently flipped. |
| 6 | Decisions honored — why | The *Why* column from brainstorming is preserved as inline rationale wherever the decision lands in the spec. A reviewer reading the spec alone should still see the reasoning. |
| 7 | Rejected options not silently revived | The spec does not implement a brainstorming-**Rejected** option without explicitly flagging the change in chat for the user to confirm. |
| 8 | Tradeoffs — OUT | Brainstorming OUT items appear in spec **Out of scope**. Items moved into scope are flagged explicitly. |
| 9 | Tradeoffs — ACCEPT | Brainstorming ACCEPT items appear in spec **Implementation notes** as documented compromises, with the brainstorming "why" preserved. |
| 10 | Open questions — resolved | Questions the spec resolves (via code reading or clarifying questions) appear as concrete behavior/contracts/error handling. |
| 11 | Open questions — carried | Questions not resolved appear in spec **Open questions** with residual-risk note. None silently dropped. |
| 12 | Security decisions | Every row of the brainstorming **Security pass** table maps to a concrete, testable spec **Security** requirement. |
| 13 | Security deferred | Anything marked "deferred" in the security pass appears in **Open questions** with residual-risk note. |
| 14 | No new scope | Spec does not introduce features or behaviors that weren't in brainstorming. (New files/types/codes are EXPECTED — brainstorming intentionally omits them. The check is for new *behavior*.) Any new behavior is listed in chat for the user to confirm before render. |

## Pass 2 — Internal consistency (spec ↔ spec)

The spec must not contradict itself.

| # | Check | What to look for |
|---|---|---|
| 1 | Goal coverage | The **Acceptance criteria** collectively make the **Goal** observable. Each meaningful aspect of the goal maps to at least one AC. |
| 2 | Error codes defined | Every status code or error name referenced in **Error handling**, **Behavior**, or **Acceptance criteria** is defined in **API contracts**. |
| 3 | Fields exist | Every field referenced in **API contracts**, **Behavior**, **Error handling**, or **Observability** exists in **Data model** (or is obviously derived from existing fields). |
| 4 | Failure modes addressed | Every failure mode shown in **Behavior** diagrams or text has a corresponding entry in **Error handling**. |
| 5 | Security testable | Every **Security** requirement has either (a) an acceptance criterion that exercises it, or (b) an explicit "code review only" note. No hand-wavy "we should be careful". |
| 6 | Observability ties to behavior | Every new metric / log / alert in **Observability** is triggered by something in **Behavior** or **Error handling**. No orphan metrics. |
| 7 | Rollout safety | **Rollout** addresses: feature-flag (or "not flagged — reason"), migration order for any schema change, rollback path. |
| 8 | Idempotency | If the spec involves retries, queues, webhooks, or external calls — there's an explicit idempotency strategy in **Error handling** or **Behavior**. |
| 9 | No empty sections | Every section either has content or explicit `N/A — <reason>`. An empty section is a hole. |
| 10 | Acceptance criteria are testable | Each AC is observable: "returns 200 within 300ms", not "is performant". |

## Report format

Output in chat. Keep it tight.

```
## Self-review

### Alignment with brainstorming (`<brainstorming-file>`)
| Check | Status | Note |
|---|---|---|
| Goal | ✓ | |
| Context preserved | ✓ | |
| Approach selection preserved | ✓ | 3 options weighed, push-based picked |
| Approach honored | ✓ | |
| Decisions — picks | ✓ | 4/4 |
| Decisions — why | ⚠ | "advisory lock" why missing rationale inline at Error handling |
| Rejected not revived | ✓ | |
| Tradeoffs — OUT | ✓ | |
| Tradeoffs — ACCEPT | ✓ | |
| Open questions | ✓ | 2 resolved, 1 carried |
| Security decisions | ✓ | 4/4 |
| Security deferred | ✓ | |
| No new scope | ✓ | |

### Internal consistency
| Check | Status | Note |
|---|---|---|
| Goal coverage | ✓ | |
| Error codes defined | ⚠ | `WHATSAPP_RATE_LIMIT` referenced in Error handling but missing from API contracts |
| Fields exist | ✓ | |
| Failure modes addressed | ✓ | |
| Security testable | ⚠ | "Validate webhook signature" needs an AC |
| Observability | ✓ | |
| Rollout safety | ✓ | |
| Idempotency | ✓ | |
| No empty sections | ✓ | |
| AC testable | ✓ | |

Result: 3 issues. Fixing before render.
```

## When to escalate to the user

If the review surfaces an issue that's not a simple typo or missing line — e.g. a brainstorming decision that doesn't actually work given the code you've now read — stop, surface it in one short message, propose the fix, get user confirmation. Don't silently revise a brainstorming decision.
