# COP4331-Large-Project

MERN monorepo (pnpm workspaces + Turborepo), structured in the spirit of the [T3 stack](https://create.t3.gg/): end-to-end typesafety, small modular pieces, and zod-validated env vars. Next.js/tRPC/Prisma are swapped for Express and MongoDB.

```
apps/
  api/       Express + MongoDB REST API (TypeScript, JWT auth)
  web/       React + TypeScript (Vite) + Tailwind
  mobile/    Flutter app (same REST API)
packages/
  shared/    zod schemas + request/response types shared by api and web
```

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in `MONGODB_URI` (MongoDB Atlas; allow your IP under Network Access) and `ACCESS_TOKEN_SECRET`.
3. `pnpm dev` — API on http://localhost:5000, web on http://localhost:5173.

Other scripts: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm dev:api`, `pnpm dev:web`.

The demo expects a `Users` collection (`UserId`, `FirstName`, `LastName`, `Login`, `Password`) and a `Cards` collection (`Card`, `UserId`) in the database named in `MONGODB_URI`.

## API (demo from the course MERN notes)

| Endpoint | Body | Notes |
| --- | --- | --- |
| `POST /api/login` | `login`, `password` | returns `{ accessToken }` (JWT) |
| `POST /api/addcard` | `userId`, `card`, `jwtToken` | returns refreshed `jwtToken` |
| `POST /api/searchcards` | `userId`, `search`, `jwtToken` | server-side partial, case-insensitive match |

Contracts live in `packages/shared/src/index.ts`. `GET /health` is a liveness check.

## Mobile (Flutter)

An Android app (iOS also builds) that uses the same REST API as the web app and
matches its dark theme (`apps/mobile/lib/theme.dart` copies the colors from
`apps/web/src/App.css`). Needs the Flutter SDK, plus Android Studio for the
Android SDK and emulator.

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
| `/home` | Game: search a country, guess, see the distance range; win or reveal the answer | `POST /api/games`, `GET /api/countries/search`, `POST /api/games/:id/guesses`, `GET /api/games/:id`, `GET /api/users/me` |
| `/leaderboard` | Players ranked by points, 20 per page | `GET /api/leaderboard` |

Protected calls send `Authorization: Bearer <accessToken>`; the token is kept in
secure storage, and a 401 logs out and returns to the login screen.

Run the tests with `flutter test` (no API needed; HTTP is faked). They cover the
validators, the API client's requests and parsing, the auth screens, and a full
game round and the leaderboard. CI runs `flutter analyze` and `flutter test` on every PR.

## Deployment

Production (DigitalOcean + nginx + pm2) steps are in the course notes (MERN B). Build with `pnpm build`; serve `apps/web/dist` with nginx and run `node apps/api/dist/index.js` under pm2 with the same env vars. Set `VITE_API_URL` before building the web app.

## Data Source
repository: world-countries-centroids
Author: Gavin Rehkemper,
https:A//github.com/gavinr/world-countries-centroids
