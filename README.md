# Country Distance Guessing Game

COP4331 Large Project, Team 18. A web and mobile game: the server secretly picks a
country, you type guesses (the input autocompletes from a **server-side partial-match
search**), and after each guess the server answers with a distance range, a rounded
distance and a compass direction. Fewer guesses means more points. Points add to your
account and rank you on the leaderboard.

**Live app:** https://cop4331-countryguesser.com

## Features

- Register, **email verification**, login and **password reset** (Resend email, hashed one-time tokens)
- JWT-protected REST API (Express + MongoDB Atlas); passwords hashed with bcrypt; auth routes rate limited
- Server-side country search with partial, case-insensitive matching
- Game logic is server-side only: the target is never sent to the client, and points are added on the server
- Resume an unfinished round, give up, play again, paginated leaderboard
- A 3D globe on web and mobile that colors each guess by distance

## Stack

| Part | Technology |
|---|---|
| Database | MongoDB Atlas |
| API | Node.js, Express, TypeScript, zod, JWT, bcrypt, Resend |
| Web | React 19, TypeScript, Vite, Tailwind CSS, MapLibre GL |
| Mobile | Flutter (Android, iOS builds too) |
| Tooling | pnpm workspaces + Turborepo, Vitest, supertest, oxlint, GitHub Actions CI |
| Hosting | DigitalOcean droplet, nginx, pm2, Let's Encrypt HTTPS |

```
apps/
  api/       Express + MongoDB REST API (TypeScript, JWT auth)
  web/       React + TypeScript (Vite) + Tailwind
  mobile/    Flutter app (same REST API)
packages/
  shared/    zod schemas + request/response types shared by api and web
docs/        API contract, OpenAPI spec, diagrams, deploy guide, test results, project plan
deploy/      nginx config
```

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in `MONGODB_URI` (MongoDB Atlas; allow your IP under Network Access) and `ACCESS_TOKEN_SECRET`. Leave `RESEND_API_KEY` empty locally and verification and reset emails print to the API console instead.
3. `pnpm dev`: API on http://localhost:5000, web on http://localhost:5173.

Other scripts: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm dev:api`, `pnpm dev:web`.
The web tests need a current Node 22 (22.15 or newer); CI uses the latest 22.

## Database

Collections: `users`, `tokens` (email verification and reset, stored as SHA-256 hashes), `games`
(guesses are embedded) and `countries`. See [docs/data-model.md](docs/data-model.md) and the
[ERD](docs/diagrams/ERD.png). Seed and import scripts are in `apps/api/scripts/`
(`idempotentImport.js` loads the country centroids and can be re-run safely). Run `pnpm --filter @cop4331/api db:indexes` once to create the indexes.

## API

Everything is JSON. Protected routes take `Authorization: Bearer <accessToken>`; errors are
`{ "error": "message" }`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | no | Create an unverified account and send the verification email |
| POST | `/api/auth/verify-email` | no | `{ token }` from the email link |
| POST | `/api/auth/resend-verification` | no | Always 200 |
| POST | `/api/auth/login` | no | Returns `{ accessToken, user }`; 403 if the email is unverified |
| POST | `/api/auth/forgot-password` | no | Always 200 (no account enumeration) |
| POST | `/api/auth/reset-password` | no | `{ token, password }`, one-time, 1 hour |
| GET | `/api/users/me` | yes | Profile and totals |
| GET | `/api/countries/search?q=fra&limit=10` | yes | Server-side partial-match search |
| POST | `/api/games` | yes | Start a round (never returns the target) |
| GET | `/api/games/:id` | yes | Resume a round |
| POST | `/api/games/:id/guesses` | yes | Submit a guess, get a distance range |
| POST | `/api/games/:id/give-up` | yes | End a round with zero points |
| GET | `/api/leaderboard?page=1&limit=20` | yes | Paginated ranking |

Full contract: [docs/api-contract.md](docs/api-contract.md). The two endpoints shown in
SwaggerHub (search and guesses) are in [docs/api/openapi.yaml](docs/api/openapi.yaml).
`GET /health` is a liveness check.

## Mobile (Flutter)

An Android app (iOS also builds) that uses the same REST API as the web app and
matches its dark theme (`apps/mobile/lib/theme.dart`). Needs the Flutter SDK, plus
Android Studio for the Android SDK and emulator.

```bash
cd apps/mobile
flutter pub get
flutter run                                # Android emulator uses http://10.0.2.2:5000 (your machine's API)
# against the deployed API:
flutter run --dart-define=API_URL=https://cop4331-countryguesser.com
# release APK for a phone (output: build/app/outputs/flutter-apk/app-release.apk):
flutter build apk --release --dart-define=API_URL=https://cop4331-countryguesser.com
```

Screens (`apps/mobile/lib/screens/`):

| Route | Screen | API |
| --- | --- | --- |
| `/` | Log in (email + password) | `POST /api/auth/login`; a 403 (unverified) opens check-inbox |
| `/register` | Sign up | `POST /api/auth/register` |
| `/check-inbox` | "Check your inbox" + resend | `POST /api/auth/resend-verification` |
| `/forgot-password` | Request a reset link (the reset itself happens on the web page from the email) | `POST /api/auth/forgot-password` |
| `/home` | Game: search a country, guess, see the distance range; win, give up or lose | `POST /api/games`, `GET /api/countries/search`, `POST /api/games/:id/guesses`, `POST /api/games/:id/give-up`, `GET /api/games/:id`, `GET /api/users/me` |
| `/leaderboard` | Players ranked by points, 20 per page | `GET /api/leaderboard` |

The game screen has a globe (drag to spin, pinch to zoom) that colors each
guessed country by distance with the same colors as the web globe, and shows the
answer in green when the round ends. Its country shapes come from the web app's
Natural Earth data; after that data changes, rebuild them with
`dart run tool/build_countries.dart` (from `apps/mobile`).

Protected calls send `Authorization: Bearer <accessToken>`; the token is kept in
secure storage, and a 401 logs out and returns to the login screen.

Run the tests with `flutter test` (no API needed; HTTP is faked).

## Tests

| Suite | Command | Covers |
|---|---|---|
| API (47 tests) | `pnpm --filter @cop4331/api test` | Registration, verification, login, password reset, JWT checks, search, game scoring, ownership checks, give-up, leaderboard, rate limiting. Runs against an in-memory fake of the MongoDB driver, so no database is needed |
| Web | `pnpm --filter @cop4331/web test` | Auth screens, search input, round logic, game page, give-up flow |
| Mobile | `cd apps/mobile && flutter test` | Validators, API client, auth screens, game round, globe |

CI runs typecheck, lint, build and tests for web and API, plus `flutter analyze` and
`flutter test` for mobile, on every pull request ([docs/pm/ci.md](docs/pm/ci.md)). Results for the
slides are in [docs/tests/](docs/tests/).

## Deployment

One droplet serves the web build and proxies `/api` to the API under pm2, on one HTTPS
origin. Exact commands to deploy and roll back are in [docs/deploy.md](docs/deploy.md).

## Documentation

- [API contract](docs/api-contract.md), [OpenAPI spec](docs/api/openapi.yaml), [data model](docs/data-model.md)
- [Diagrams](docs/diagrams/README.md): use case, sequence (register/verify/login and password reset), activity, ERD, mobile class diagram
- [Web and mobile design](docs/design.md)
- [Project plan](TASKS.md), [Gantt chart](docs/pm/gantt.md), [deliverables checklist](docs/pm/deliverables.md), [risks](docs/pm/risks.md)

## Credits

Country centroids: [world-countries-centroids](https://github.com/gavinr/world-countries-centroids)
by Gavin Rehkemper. Map data and assets: Natural Earth (public domain), OpenFreeMap, OpenStreetMap
contributors (see [apps/web/public/data/SOURCES.md](apps/web/public/data/SOURCES.md)).
