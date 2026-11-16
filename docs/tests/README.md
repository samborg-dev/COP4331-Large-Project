# Test results

Evidence for the "unit and integration test results" slide.

| Suite | Result | Evidence |
|---|---|---|
| API (Vitest + supertest) | 47 passed, 4 files | [api.png](api.png), full log [api.txt](api.txt) |
| Web (Vitest + Testing Library) | **TODO (John):** capture a run | `web.png` |
| Mobile (Flutter) | **TODO (Arwa):** capture a run | `mobile.png` |

## How to capture a run

```bash
# API: no database or network needed (the MongoDB driver is replaced by an in-memory fake)
pnpm --filter @cop4331/api test

# Web (needs Node 22.15 or newer)
pnpm --filter @cop4331/web test

# Mobile
cd apps/mobile && flutter test
```

Take a screenshot of the terminal output and save it here as `web.png` / `mobile.png`.
For a text log: `pnpm --filter @cop4331/web exec vitest run --reporter=verbose > docs/tests/web.txt`.

## What the API suite covers

- **Auth:** register (hashing, token hash stored, duplicate 409, validation 400), verify email
  (success, reused, expired, bogus), resend, login (403 unverified, identical 401 for bad email and bad
  password, JWT contents), forgot and reset password (no account enumeration, one-time token,
  expiry, short password), JWT checks (missing, malformed, forged, expired).
- **Search:** server-side partial match (prefix, middle, case-insensitive), empty query, no match,
  regex characters taken literally, limit, auth required.
- **Game:** start never leaks the target, distance ranges, scoring (100 down to a floor of 10),
  win and loss bookkeeping on the user, finished rounds rejected, other players' rounds rejected,
  client-sent points ignored, give-up (once only, zero points, answer revealed).
- **Leaderboard and profile:** ranking, pagination, auth required.
- **Rate limiting:** the auth limiter answers 429 after 25 requests.
