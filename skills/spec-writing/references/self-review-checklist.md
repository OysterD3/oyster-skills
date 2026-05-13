# Spec self-review

Run AFTER drafting the spec and BEFORE rendering the HTML. Two passes. Both must come back clean (all ✓). Any ⚠ or ✗ means stop, fix the spec, re-run.

## How to use

1. Have the brainstorming HTML and the draft spec loaded in your working context.
2. Walk both tables below, item by item, and mark ✓ / ⚠ / ✗ with a one-line note for non-✓ items.
3. Output the result in chat as a short table — the user benefits from seeing the rigor.
4. If any item is non-✓: amend the spec, then re-run only the items that could be affected by the amendment.
5. When all items pass, proceed to render HTML.

## Pass 1 — Alignment (spec ↔ brainstorming)

The brainstorming artifact is the source of truth for *what* and *why*. The spec must not silently drop, contradict, or add to it.

| # | Check | What to look for |
|---|---|---|
| 1 | Goal | Spec **Goal** matches brainstorming **Goal** semantically. Tightened wording is OK; new scope is not. |
| 2 | Files to touch | Every brainstorming file entry appears in spec **Implementation notes** (or its omission is explicitly justified). |
| 3 | Data & contract changes | Every brainstorming data/contract change appears in spec **API contracts** or **Data model**. None silently dropped. |
| 4 | Execution order | Brainstorming order is reflected in spec **Rollout**. If changed, the change is noted with reason. |
| 5 | Out of scope | Brainstorming **Out of scope** items appear verbatim (or near) in spec **Out of scope**. Items moved into scope are flagged explicitly. |
| 6 | Open risks — resolved | Risks the spec actively addresses now appear as spec behavior, error handling, or security requirements. |
| 7 | Open risks — carried | Risks not addressed appear in spec **Open questions** with a residual-risk note. None silently dropped. |
| 8 | Security pass — decisions | Every row of the brainstorming **Security pass** table maps to a concrete, testable spec **Security** requirement. |
| 9 | Security pass — deferred | Anything marked "deferred" in the security pass appears in **Open questions** with residual-risk note. |
| 10 | No new scope | Spec does not introduce features, behaviors, or files that weren't in brainstorming. If it does, those additions are listed in chat for the user to confirm before render. |

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
| Files | ✓ | 5/5 |
| Data changes | ⚠ | `phone_number` column not in Data model |
| Out of scope | ✓ | |
| Open risks | ✓ | 2 resolved, 1 carried |
| Security decisions | ✓ | 4/4 |
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
