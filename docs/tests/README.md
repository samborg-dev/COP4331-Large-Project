# Test results

Evidence for the "unit and integration test results" slide.

| Suite | Result | Evidence |
|---|---|---|
| API (Vitest + supertest) | 48 passed, 4 files | [api.png](api.png), full log [api.txt](api.txt) |
| Web (Vitest + Testing Library) | 71 passed, 6 files | [web.png](web.png), log [web.txt](web.txt) |
| Mobile (Flutter) | 33 passed, 5 files | [mobile.png](mobile.png), log [mobile.txt](mobile.txt) |

## How to capture a run

```bash
# API: no database or network needed (the MongoDB driver is replaced by an in-memory fake)
pnpm --filter @cop4331/api test

# Web (needs Node 22.15 or newer)
pnpm --filter @cop4331/web test

# Mobile
cd apps/mobile && flutter test
```

`web.png` and `mobile.png` were built from the GitHub Actions run on `main` (run 43791521541, commit 374eb8c),
where both suites passed on every test. Retake them from a local run or a newer CI run if the code changes.

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
