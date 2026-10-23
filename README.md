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

Flutter is not set up by this repo's scripts. On a machine with the Flutter SDK:

```bash
cd apps/mobile
flutter create . --platforms=android,ios   # generates android/ and ios/ (keeps lib/ and pubspec.yaml)
flutter pub get
flutter run                                # Android emulator uses http://10.0.2.2:5000 automatically
# or point at a deployed API:
flutter run --dart-define=API_URL=https://your-domain.com:5000
```

## Deployment

Production (DigitalOcean + nginx + pm2) steps are in the course notes (MERN B). Build with `pnpm build`; serve `apps/web/dist` with nginx and run `node apps/api/dist/index.js` under pm2 with the same env vars. Set `VITE_API_URL` before building the web app.
