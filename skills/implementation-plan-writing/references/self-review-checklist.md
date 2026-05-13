# Impl plan self-review

Run AFTER drafting and BEFORE rendering the HTML. Two passes. Both must come back all ✓.

## How to use

1. Have the spec MD and the draft plan loaded in your working context.
2. Walk both tables. Mark ✓ / ⚠ / ✗ with a one-line note for non-✓ items.
3. Output the result in chat as a short table.
4. If anything is non-✓: amend the plan, then re-run only the affected items.
5. When all ✓, render the HTML.

## Pass 1 — Alignment (plan ↔ spec)

| # | Check | What to look for |
|---|---|---|
| 1 | Goal | Plan **Goal** matches spec **Goal** verbatim or near-verbatim. |
| 2 | Acceptance criteria coverage | Each spec AC is exercised by at least one step's **Tests** entry. Map each AC → step(s). No AC orphaned. |
| 3 | API contracts | Every endpoint in spec **API contracts** has a creating step (DTO + controller + route). |
| 4 | Data model | Every schema change in spec **Data model** has a migration step + a Drizzle schema update step (or one combined step if tightly coupled). |
| 5 | Behavior | Every flow/state in spec **Behavior** maps to one or more steps that implement it. |
| 6 | Error handling | Every error path in spec **Error handling** has either dedicated handler code in a step or a test in a step that exercises it. |
| 7 | Security | Every requirement in spec **Security** maps to a code change in a step OR an explicit "covered by existing `<layer>`" note (e.g. auth guard already on the controller base class). No hand-wavy gaps. |
| 8 | Observability | Every metric/log/alert in spec **Observability** is added in a step (with the file/location). |
| 9 | Rollout | Spec **Rollout** strategy is reflected in plan **Strategy** and **Pre-flight** (feature flag, migration order, rollback path). |
| 10 | Out of scope honored | No step introduces anything listed in spec **Out of scope**. |
| 11 | Open questions | Every spec **Open question** is either (a) resolved in a step with explicit decision, or (b) carried into plan **Risks** or **Notes**. None silently dropped. |
| 12 | No scope creep | Plan does not add features, files, or behaviors not in spec. If it does, those additions are listed in chat for user confirmation before render. |

## Pass 2 — Internal consistency (plan ↔ plan)

| # | Check | What to look for |
|---|---|---|
| 1 | DAG acyclic | Every step's **Depends on** only refers to steps with a lower number. No cycles. |
| 2 | Topological order | If step B depends on step A, step B comes after step A in the numbered list (not just in the DAG). |
| 3 | Files exist or are created | Every file path in a step's **Files** either pre-exists in the codebase OR is created by an earlier step in the plan. |
| 4 | Test files traceable | Every test file mentioned in **Tests** either pre-exists OR is added by this step (call out explicitly if pre-existing). |
| 5 | Migration rollback | Every step that runs a DB migration, alters a queue topology, or flips a shared feature flag has a **Rollback** entry with a concrete command or procedure. |
| 6 | Step ordering heuristics | Types defined before consumers, migrations before code reading new state, DAL before services, services before controllers/workers, credentials/config before the code that uses them. |
| 7 | Verification is runnable | Every **Verification** entry is a concrete command (or precise manual procedure), not "test it works." |
| 8 | Pre-flight is complete | **Pre-flight** covers: branch state, env vars added, dependencies installed, feature flag created (if used), spec approved. |
| 9 | Post-flight covers every AC | **Post-flight** checks include every spec AC, either via tests run or explicit smoke check. |
| 10 | UI changes acknowledged | If any step touches frontend code, **Post-flight** includes "start dev server, exercise feature in browser" per project CLAUDE.md. |
| 11 | Step size sanity | No step's expected diff exceeds ~300 lines. If it would, split. No step is trivially small (e.g. "import one type") unless splitting protects an intermediate state. |
| 12 | No empty sections | Every plan section has content or `N/A — <reason>`. |
| 13 | Test stubs are stubs | **Tests** entries are names + one-line intent. Not full coverage analysis (that's test-review's job). |

## Report format

```
## Self-review

### Alignment with spec (`<spec-file>`)
| Check | Status | Note |
|---|---|---|
| Goal | ✓ | |
| AC coverage | ⚠ | AC4 ("rate-limited to 100/min") not exercised in any step's tests |
| API contracts | ✓ | 2/2 endpoints have steps |
| Data model | ✓ | |
| Behavior | ✓ | |
| Error handling | ✓ | |
| Security | ⚠ | Webhook signature verification not in any step |
| Observability | ✓ | |
| Rollout | ✓ | |
| Out of scope honored | ✓ | |
| Open questions | ✓ | 1 resolved, 1 carried to Risks |
| No scope creep | ✓ | |

### Internal consistency
| Check | Status | Note |
|---|---|---|
| DAG acyclic | ✓ | |
| Topological order | ✓ | |
| Files exist or created | ⚠ | Step 4 references `src/queues/forward.queue.ts` but no step creates it |
| Test files traceable | ✓ | |
| Migration rollback | ✓ | Step 1 has rollback line |
| Step ordering heuristics | ✓ | |
| Verification runnable | ✓ | |
| Pre-flight complete | ✓ | |
| Post-flight covers ACs | ⚠ | AC4 missing post-flight check |
| UI changes | N/A | Backend-only |
| Step size sanity | ✓ | |
| No empty sections | ✓ | |
| Test stubs are stubs | ✓ | |

Result: 3 issues. Fixing before render.
```

## When to escalate

If review surfaces a gap that requires changing the spec (e.g. an AC truly cannot be implemented as written given the code you've now read), stop, surface it in one short message, propose the spec amendment, get user confirmation. Do not silently revise spec decisions in the plan.
