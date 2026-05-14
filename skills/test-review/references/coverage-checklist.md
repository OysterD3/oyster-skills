# Coverage checklist

The rigor pass. Walk every section that applies. For each item: confirm it's covered by an existing or proposed test, OR add it to **Gaps & risks** / **Recommendations**.

## 1. AC coverage (chained mode)

For each spec acceptance criterion:

- Map it to one or more tests that exercise it
- The test must assert the **observable outcome** the AC promises, not just call the function
- If no proposed test covers it → ✗ gap → recommend a specific test (file + intent)

A row with status "covered" requires you to have READ the test and confirmed the assertion matches the AC. Don't trust the test name.

## 2. Path coverage (per route / function / handler)

For each significant function/route in scope:

| Path | Cover? |
|---|---|
| Golden path (valid input, expected success) | Always |
| Auth/authz failures (when route has auth) | Always |
| Validation errors (per field with non-trivial rules) | When validation can fail |
| Not-found / 404 (when fetching) | When lookup can fail |
| Conflict / 409 (unique constraints, duplicate operations) | When state matters |
| Permission errors (tenant/owner scoping) | When scoping exists |
| Timeout / external service failure | When external calls exist |
| Boundary values (min, max, off-by-one) | When numeric bounds exist |
| Empty / null inputs (empty string, empty array, missing optional field) | When inputs accept these |
| Large / max-size inputs (max-length string, max-size payload, large list) | When bounds exist |
| Concurrent operations (race conditions, idempotency) | When state mutates |

Skip rows that aren't applicable with explicit reason. "Not applicable" without a reason is a hole.

## 3. Mock policy (HARD RULES)

| Target | Allowed to mock? | Notes |
|---|---|---|
| Project's Postgres | **Never** | Integration tests hit a real DB. Use test DB with rollback per test, or transactional fixtures. |
| Project's Redis | **Never** | Same reasoning. |
| Project's queue (BullMQ etc.) | **Never** | Use the real queue with a test-scoped connection or in-process worker. |
| External third-party APIs (payment gateways, email providers, etc.) | **Yes** | Use fixtures, nock, or msw. The integration with these is tested via contract tests, not by hitting prod. |
| Time (`Date.now`, `new Date`) | **Yes** | Inject a clock or use `jest.useFakeTimers`. |
| Randomness (`Math.random`, `crypto.randomUUID`) | **Yes** | Seed it or inject. |
| Filesystem | **Sometimes** | Real FS in a temp directory is fine; mock when the file shape is the unit-under-test contract. |
| HTTP fetch to internal services | **Yes for unit, no for integration** | Unit tests mock fetch; integration tests boot the dependent service or hit a test instance. |

Every mock in the proposed/existing test suite must:
- Have a clear justification ("this is third-party API X, requires API key, rate-limited")
- Be honest about what it replaces (mocking `db.query` to "test the DAL" is mocking the DAL's only real responsibility — that's a ✗)

## 4. Test type guidance

When choosing the test type:

- **Unit**: pure functions, validation, formatting, business rules without external state. Fast (<10ms). Best ROI for branch-heavy logic.
- **Integration**: anything that touches the DB, queue, or another service the project owns. Hit a real test DB. Most controller/service/DAL tests live here per project rule.
- **E2E**: full request-to-response through real HTTP, real DB, real worker. Reserve for golden paths of critical flows; expensive to maintain.
- **Security**: explicit auth-bypass attempts, injection attempts, fuzzing, rate-limit verification. Often an integration test with specific malicious inputs.
- **Performance**: rate limits, batch operations, queue depth, response time SLOs. Use a load-test tool (`autocannon`, `k6`, `artillery`) — these usually run separately from the main test suite.

Match the type to what's being verified, not to what's easy. A DAL function that only matters because of DB behavior is an integration test, not a unit test with a mocked DB.

## 5. Determinism review

Patterns that cause flakes — flag every instance:

| Pattern | Fix |
|---|---|
| `new Date()` / `Date.now()` in assertions or compared values | Inject a clock or use fake timers |
| `setTimeout` / `setInterval` in tests | Fake timers or eliminate the wait |
| `await sleep(n)` to "wait for async" | Use `waitFor` patterns or wait on the actual signal (event, queue depth, DB state) |
| Network calls to live external services | Mock them (third-party) or boot a test instance (internal) |
| `Math.random` or unseeded UUID generation in test data | Inject deterministic generators or use fixed test data |
| Tests that share module-level state | Reset state in `beforeEach`; prefer ESM modules without singletons |
| Tests that depend on execution order | Each test must pass when run alone — verify with `--runInBand --testNamePattern` |
| Reliance on FS state from prior tests | Use `tmp` directories per test |
| Date-based logic without timezone control | Pin timezone in test setup |

## 6. Security tests

For every Security item in the spec:

- **AuthN check** → test that returns 401 with no token, 401 with invalid token
- **AuthZ check** → test that returns 403 when scoped to a different tenant/owner
- **Input validation** → test that returns 400 for each violated constraint
- **Injection** → test with classic SQL injection / XSS / template injection payload appropriate to the surface
- **Rate limit** → test that the (N+1)th request in the window returns 429
- **Idempotency key** → test that repeated request with same key returns the same response without double-effect
- **Webhook signature** → test that bad signature returns 401; test replay of same signature is rejected if applicable

## 7. Performance tests (when applicable)

Only when the spec has a perf-sensitive requirement:

- Rate-limit thresholds (verify the limiter actually limits)
- Batch operations (verify response time stays bounded as N grows)
- Queue depth (verify the producer back-pressures or sheds load)
- Large payload (verify body parser caps and 413 fires)
- Concurrent request (verify the system doesn't deadlock; verify response time degradation)

These usually live in a separate suite (`perf/` or `load/`) and run on-demand, not in CI by default.

## 8. Test naming

Names describe behavior, not implementation:

| Bad | Good |
|---|---|
| `calls hasAccess()` | `rejects unowned post with 403` |
| `returns true when valid` | `accepts E.164-formatted phone number` |
| `does not throw` | `succeeds when archiving a post the user owns` |
| `unit test for archive` | `enqueues purge job after archiving a post` |

A reader who has never seen the code should understand what the test proves from the name alone.

## 9. Test isolation

- Each test sets up its own state. No "given the DB has 10 posts from the previous test."
- Each test cleans up (or uses a per-test transaction that rolls back).
- No global mutable test setup unless idempotent (e.g. migrations).
- No test imports another test file's helpers via side effects.

## 10. Assertion quality

A test without an assertion that verifies the outcome is not coverage:

- `expect(result).toBeDefined()` is weak — assert the **shape** or **value**
- `expect(fn).not.toThrow()` is weak — assert what `fn` did (DB row created, queue entry, response code)
- `expect(mock).toHaveBeenCalled()` is implementation-leak — prefer asserting the observable side effect
- Snapshot tests are OK for output shape but should not be the ONLY assertion for behavior-critical code

## Summary of "automatic ✗"

These conditions automatically fail self-review:

- A mock of the project DB / Redis / queue
- A test name that describes implementation
- A test with no behavior assertion
- An AC with no test
- A determinism risk with no fix
- An empty section with no `N/A` reason
