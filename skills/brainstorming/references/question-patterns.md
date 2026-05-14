# Question patterns

Every question must do one of these. If it doesn't, don't ask it. After every answer, capture the *why* — that's what a teammate reads first.

## Surface a tradeoff
Frame as a fork with the cost of each branch named.
> "Two ways to handle dedupe: (a) DB unique constraint — atomic but throws on race, must catch a specific error; (b) advisory lock around the insert — cleaner error handling but serializes writes for that key. (a) is faster under low contention, (b) is friendlier if you'll do multi-row work in the same critical section. Which fits this flow — and what's the deciding factor?"

## Surface a gotcha
Name the trap before they step in it.
> "If we dispatch by source ID and the source resource is deleted before our worker processes it, the upstream returns 404 and our retry queue stalls. Want to (a) snapshot the payload at enqueue time and re-send on failure, or (b) accept the loss and log? (a) is more work but keeps history intact. What matters more here?"

## Challenge an assumption
Quote what they said, then the weakness, then the alternative.
> "You mentioned storing the API key on the user record. That puts a secret in a row read across the worker and the API, and it'll surface in any debug log of that row. A secrets table with restricted reads, or vault/env, would be safer. Is there a reason row-level placement is intentional?"

## Force a scope decision
When the user is conflating two features.
> "What you're describing is really two changes: the notification pipeline AND the audit trail. They have different failure modes. Both in this PR, or land notifications first and audit as a follow-up — and why?"

## Probe a thin "why"
When the picked option is clear but the reason isn't.
> "You picked the lock approach over the unique constraint. Is the reason: (a) it composes with future multi-row work in the same critical section, (b) the team is more comfortable debugging lock contention than catching specific error codes, or (c) something else? I want to put the actual reason in the decisions table so a reviewer knows what to push back on if they disagree."
