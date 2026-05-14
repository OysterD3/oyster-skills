# Security pass

Run this AFTER the functional plan is agreed and BEFORE sign-off. Walk each applicable section with the user. Do not implement during this pass — it's still brainstorming.

For each item: name the threat, name the mitigation, decide who's responsible (this PR vs. existing layer vs. follow-up). If a mitigation is being deferred, say so explicitly and note the residual risk.

**This is the backstop, not the whole pass.** Feature-specific threat modeling happens *before* this — the brainstorming workflow has the probe ("name 1–3 threats unique to this feature's surface"). A checklist catches the same dozen categories every time; it won't catch LLM prompt injection, RLS bypass, replay attacks, or whatever's specific to your feature. Don't skip the probe and lean on this one alone.

## How to use

1. Skim every section header. Mark each "applies" / "N/A — because…". A header marked N/A without a reason is a hole.
2. For applicable sections, walk the items as questions to the user — one or a tight cluster at a time.
3. If any answer is "we'll handle that later," capture it in the plan's **Open questions** section with a residual-risk note.
4. Block sign-off if any **must-not-defer** item below is unresolved.

## Must-not-defer items

These cannot be left to a follow-up PR:

- Authentication on any new endpoint that reads or writes user/tenant data.
- Authorization (tenant/owner scoping) on any new query that joins user-scoped tables.
- Secret storage: no plaintext credentials, tokens, or keys in code, logs, error messages, or DB columns readable in normal flows.
- SQL/NoSQL injection: parameterized queries only. No string-interpolated SQL with user input.
- Command injection: no `exec`/`spawn`/shell calls with unsanitized user input.

## Sections

### 1. AuthN / AuthZ
- New endpoint, queue handler, or webhook? Verify auth guard is present.
- Does the handler scope by `tenantId` / `userId` / `<resource>Id` (whatever the ownership boundary is)? A query without that scope is a tenant-bleed bug waiting to happen.
- Role/permission check needed beyond authenticated? (admin vs. member, write vs. read)
- Webhook endpoints: signature verification with shared secret, replay protection, source IP allowlist if available.
- Service-to-service: mTLS, signed JWT with short TTL, or API key from secret store — never a long-lived bearer in code.

### 2. Input validation
- Every external input passed through a Zod (or equivalent) schema at the boundary?
- String length caps on all free-text fields (DoS via unbounded input).
- Numeric range caps where business logic assumes bounds.
- Enum/union validation for any field that maps to a switch or DB enum.
- File uploads: MIME sniffing (not just extension), size cap, magic-byte verification for image/PDF types.

### 3. Output / injection
- SQL: parameterized via ORM or `$1`-style placeholders. Search for any string concatenation around `db.execute`, `sql`` `` `, or raw query.
- HTML: rendered via framework escaping, no `dangerouslySetInnerHTML` with user content.
- Shell: avoid entirely. If unavoidable, pass args as array, never as a single string.
- Logs: do not log secrets, tokens, full request bodies for auth routes, or PII without a redaction step.
- Error responses to clients: generic message + opaque ID; full detail goes to server logs only.

### 4. Secrets & sensitive data
- Where does the secret live? (env, vault, secrets table with restricted read, KMS-encrypted column)
- Who can read it? Trace the access path. If it's broader than "the one service that uses it," narrow.
- Rotation path: how do we rotate without downtime? If unclear, flag as Open risk.
- PII (phone numbers, message bodies, identifiers): retention policy, access logging, scope of who can query.
- Backups and replicas: encrypted? Same access controls?

### 5. Rate limiting / abuse / DoS
- New public endpoint? Per-IP and per-user rate limit configured.
- New queue producer? Bound the queue size or use back-pressure — unbounded queues are the classic memory-OOM path.
- New retry loop? Exponential backoff with a max cap and a circuit breaker. Infinite retries on a 4xx are a self-DoS.
- Expensive query exposed to user input? LIMIT cap, timeout, or denormalization.

### 6. Transport & storage
- HTTPS-only (HSTS, no http→https mixed content).
- Cookies: HTTPOnly, Secure, SameSite. JWT in HTTPOnly cookie not localStorage.
- CORS: explicit origin list, no `*` with credentials.
- Webhooks / outbound calls: TLS verification not disabled.
- Encryption at rest for sensitive columns where the threat model warrants it.

### 7. Idempotency & race conditions
- Webhook handler: idempotency key or dedup on `external_id`. Replays must be safe.
- Concurrent writes to the same row: unique constraint, advisory lock, or optimistic concurrency. Not "we hope it won't happen."
- Worker retries: handler is idempotent end-to-end, including any side effects (sent messages, API calls, file writes).

### 8. Supply chain
- New dependency added? Check maintenance status, weekly downloads, last commit, known CVEs.
- Pinning: exact version or sensible range? `^` on a security-critical lib can pull in a malicious patch.
- Transitive risk: does it pull in a large dep tree? Audit the top 3 transitive deps.

### 9. Audit & observability
- Sensitive action (auth change, role change, tenant write, mass export)? Audit log entry with actor, action, target, timestamp.
- Failed-auth and authz-denied events logged with enough detail to detect brute force, not enough to leak secrets.
- Metrics/alerts for the new flow: error rate, latency, queue depth.

### 10. Privacy & compliance
- New PII collection? Documented purpose, retention, deletion path.
- User deletion: does the new data participate in delete-user flows? If yes, verify cascade or soft-delete.
- Data export: included in user data export if you have one?
- Cross-border data: any restrictions to honor?

## Conditional sub-checklists

Walk these *only if* the feature touches the relevant surface. They're add-ons to the generic sections above, not replacements. Mark "N/A — feature doesn't touch this" if not applicable; do not silently skip.

### A. LLM in the loop

Trigger: the feature sends prompts to a language model, parses model output, or runs tools/functions chosen by the model.

- **Prompt injection**: any user-controlled text reaches the model? Treat model output as adversarial. Never `eval` it, never directly trigger destructive tools without an intermediate guard or user confirmation.
- **System-prompt and context leakage**: assume the system prompt and any in-context data will be exfiltrated by a determined user. Don't put secrets, internal hostnames, or another user's data in the context window.
- **Output sanitization**: rendering model output as HTML/Markdown? Sanitize like any other user-supplied content. Model-generated XSS is still XSS.
- **Decision integrity**: if the model output drives an authorization, billing, or moderation outcome, what happens when it hallucinates? Is there a deterministic guard, or does a bad output ship a bad outcome?
- **Provider data handling**: what's in the context window that crosses the network to the model provider? Match their data-retention/training terms to your privacy commitments.
- **Inference-path rate limiting**: a single user can torch the inference budget. Per-user / per-tenant caps separate from the model provider's own rate limits.

### B. Cryptographic operations

Trigger: the feature signs, encrypts, derives keys, generates tokens, or compares secrets.

- **Algorithm choice**: use the language/platform's vetted default (libsodium, Web Crypto, language-stdlib crypto). No custom protocols, no DES/MD5/SHA1, no ECB-mode block ciphers.
- **IV / nonce uniqueness**: random nonces for AEAD; never reused across messages with the same key.
- **Key storage**: KMS, secrets vault, or env. Never alongside the data the key protects.
- **Key rotation**: documented rotation path. Keys are not "set once at install."
- **Timing-safe comparison**: secret/token comparisons use constant-time compare (`crypto.timingSafeEqual` or equivalent). `==` on a token is a timing oracle.
- **Token format**: signed tokens include `iat`, `exp`, and `jti` (replay defense). Use a vetted JWT/PASETO library; don't hand-roll.

## Final gate

Before declaring the security pass complete, ask the user explicitly:

> "Anything in this plan that, if it leaked or failed, would require a customer notification or a postmortem? If yes, are the mitigations above sufficient?"

If the answer is unclear, the pass is not complete.
