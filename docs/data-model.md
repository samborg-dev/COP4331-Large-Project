# Data model

MongoDB Atlas database, four collections. The [ERD](diagrams/ERD.png) is generated from
[diagrams/erd.puml](diagrams/erd.puml). Game rules and types live in
`apps/api/src/models/`.

## `users`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `firstName`, `lastName` | string | |
| `email` | string | Lowercased; unique index |
| `passwordHash` | string | bcrypt (cost 10); the password is never stored |
| `emailVerified` | boolean | `false` until the verification link is used; login returns 403 until then |
| `totalPoints` | int | Only changed on the server with `$inc`; the leaderboard sorts on it |
| `gamesPlayed`, `gamesWon` | int | |
| `createdAt` | date | |

## `tokens`

Email verification and password reset links. Only a SHA-256 hash is stored; the raw
token exists only in the email.

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | References `users._id` |
| `type` | `"verify"` or `"reset"` | |
| `tokenHash` | string | SHA-256 of the raw token |
| `expiresAt` | date | 24 hours for `verify`, 1 hour for `reset`; a TTL index removes expired rows |

A used token is deleted, and requesting a new link deletes the user's older token of that type.

## `games`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | References `users._id` |
| `targetCountry`, `targetIso` | string | The secret country. Never returned while the round is active |
| `targetLat`, `targetLng` | double | Centroid used for distance |
| `status` | `IN_PROGRESS`, `WON`, `LOST` | The API maps these to `active`, `won`, `lost` |
| `guesses` | array | Embedded `GuessEntry` documents, at most 10 |
| `pointsEarned` | int | `max(10, 100 - 10 x (guesses - 1))` for a win, 0 otherwise |
| `surrendered` | boolean | `true` when the player gave up |
| `createdAt` | date | |

`GuessEntry`: `countryId`, `guessName`, `lat`, `lng`, `distance` (km, rounded to 10), `range`
(`< 500 km` ... `> 6,000 km`, or `Correct`), `direction` (`N` ... `NW`, or `Correct`), `createdAt`.

## `countries`

Country centroids from [world-countries-centroids](https://github.com/gavinr/world-countries-centroids),
imported by `apps/api/scripts/idempotentImport.js` (safe to re-run).

| Field | Type | Notes |
|---|---|---|
| `name` | string | Searched with a case-insensitive partial match |
| `iso` | string | ISO code |
| `lat`, `lng` | double | Centroid. Distance is the great-circle (haversine) distance between centroids |

The API also reads the original GeoJSON layout (`features[].properties.COUNTRY`,
`features[].geometry.coordinates`), so either shape works.

## Indexes

Created by `pnpm --filter @cop4331/api db:indexes` (idempotent; run it once against a new database):

- `users`: `email` (unique), `totalPoints` + `gamesWon` descending (leaderboard)
- `tokens`: `expiresAt` (TTL), `tokenHash`
- `games`: `userId` + `status`

## Relationships

- A user has many games (`games.userId`) and many tokens (`tokens.userId`).
- A game targets one country, and each guess in it refers to one country.
- Rankings are computed from `users.totalPoints` (ties broken by `gamesWon`).
