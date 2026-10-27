# Country Distance Guessing Game: Team Task Breakdown

**Stack:** MongoDB Atlas + Express (Node/TypeScript) API, React + TypeScript web app
(Vite + Tailwind), Flutter mobile app, all on a DigitalOcean droplet behind a real
domain with HTTPS. JWT auth, email verification and password reset.

**The game:** the server secretly picks a country. The player types guesses (the
input autocompletes from a server-side partial-match search), and after each guess
the server answers with a distance range ("1,500–3,000 km"). Fewer guesses means
more points. Points add to the player's account and rank them on the leaderboard.
Source: `Team18 Feasibility Analysis.pdf`, Idea 1, and its MVP list.

**Due: Sun Nov 15, 11:59 pm on WebCourses. That's 20 days from Tue Oct 27.**
Features freeze **Wed Nov 11**. The deck, tests and diagrams are done **Fri Nov 13**.
All five WebCourses submissions are in **Sat Nov 14**. Presentation slots are
assigned later.

The full chart is in [docs/pm/gantt.md](docs/pm/gantt.md). Every graded item and who
owns it is in [docs/pm/deliverables.md](docs/pm/deliverables.md). Risks and the
lessons from the small project are in [docs/pm/risks.md](docs/pm/risks.md).

---

## 0. Read this first (everyone)

### GitHub activity is worth 20 of 100 points, the same as the working demo.

It is graded **per person** on commit frequency, consistency, code contributions,
code reviews, and documentation. In the small project, most commits landed in the
last week, some people's commits all landed on the due day, and PRs were still
being merged three days after the deadline. The graph shows all of that.

**Rules:**
- **Commit at least every 2 days, from this week on.** With 20 days there's no
  room to catch up at the end. Small commits with real messages:
  `add haversine distance + range buckets`, not `Update api.ts`.
- **Write code locally and push it.** Don't edit in the GitHub web UI.
  "Add files via upload" and "Update login.php" read as low effort and skip your
  local typecheck.
- **One git identity per person**, using the email that's verified on your GitHub
  account, or your commits may not count toward your graph:
  ```bash
  git config --global user.name  "Your Name"
  git config --global user.email "the-email-on-your-github-account"
  ```
- **Review at least two teammates' PRs every week** and leave a real comment.
  "Code reviews" is in the rubric by name. Review within 24 hours, because a PR
  waiting two days is 10% of the schedule.
- **Never commit secrets.** `.env` is gitignored. Real values go in Discord DMs or
  directly on the server. The small project's database password ended up in a
  public repo; don't repeat that.

### How we work in Git

```bash
git checkout main && git pull
git checkout -b yourname/short-description
# ...work, commit small...
pnpm typecheck && pnpm build        # must pass before you push
git push -u origin yourname/short-description
```

Open a PR, fill in the template, request a reviewer, and merge after one approval.
`main` is protected. If `pnpm-lock.yaml` conflicts, take `main`'s version and
re-run `pnpm install`; don't hand-edit it. If anything else conflicts and you're
unsure, **ask in Discord before force-pushing anything.**

---

## 1. Where everything lives

```
apps/
  api/        Express + MongoDB REST API (TypeScript)        Sebastian, Noah, Arwa
  web/        React + TypeScript + Tailwind (Vite)            John
  mobile/     Flutter app (Android, iOS optional)             Arwa
packages/
  shared/     zod schemas + request/response types            Sebastian (contract owner)
docs/
  api-contract.md     the JSON contract, human-readable        Sebastian
  data-model.md       collections, fields, indexes             Noah
  design.md           Figma links, colors, fonts, spacing      John + Arwa
  deploy.md           droplet, nginx, pm2, how to deploy       Sam
  api/openapi.yaml    SwaggerHub spec (2 endpoints)            Noah
  diagrams/*.puml     PlantUML sources (course requires it)    see docs/diagrams/README.md
  tests/              test-run screenshots for the slides      everyone
  pm/                 Gantt, deliverables, risks               Sam
```

The cards demo from the course notes (`/api/addcard`, `/api/searchcards`,
`CardPage`) is scaffolding. It gets removed as the real endpoints land.

## 2. The API contract (draft: Sebastian finalizes by Fri Oct 30)

Everything is JSON. Protected routes take `Authorization: Bearer <accessToken>`.
Errors always come back as `{ "error": "human-readable message" }` with a real HTTP
status (400/401/403/404/409/429/500).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create account (unverified) and send verification email |
| POST | `/api/auth/verify-email` | – | `{ token }` from the email link; marks the account verified |
| POST | `/api/auth/resend-verification` | – | `{ email }`; always responds 200 |
| POST | `/api/auth/login` | – | Returns `{ accessToken, user }`; **403 if not verified** |
| POST | `/api/auth/forgot-password` | – | `{ email }`; always responds 200 (no account enumeration) |
| POST | `/api/auth/reset-password` | – | `{ token, password }` |
| GET | `/api/users/me` | ✔ | Name, email, total points, games played/won |
| GET | `/api/countries/search?q=fra&limit=10` | ✔ | **Server-side partial match** (the search requirement) |
| POST | `/api/games` | ✔ | Start a round; returns `{ gameId, maxGuesses }`, **never the target** |
| GET | `/api/games/:id` | ✔ | Resume a round (guesses so far, status) |
| POST | `/api/games/:id/guesses` | ✔ | `{ countryId }` → `{ country, range, solved, guessesUsed, pointsEarned? }` |
| GET | `/api/leaderboard?page=1&limit=20` | ✔ | Paginated ranking by total points |

**The two SwaggerHub endpoints:** `GET /api/countries/search` and
`POST /api/games/:id/guesses`.

**Email links open the web app** (`https://<domain>/verify-email?token=…` and
`/reset-password?token=…`), even for people who signed up on mobile. Mobile only
needs "check your inbox" and "forgot password" screens, which keeps Flutter scope
down.

## 3. Data model (draft: Noah owns it, finalizes by Tue Nov 3)

| Collection | Fields | Indexes |
|---|---|---|
| `users` | firstName, lastName, email, passwordHash, emailVerified, totalPoints, gamesPlayed, gamesWon, createdAt | `email` unique; `totalPoints` desc |
| `tokens` | userId, type (`verify` \| `reset`), tokenHash, expiresAt | TTL on `expiresAt`; `tokenHash` |
| `countries` | name, aliases[], iso2, iso3, continent, lat, lng | `name`, `aliases` |
| `games` | userId, targetCountryId, status (`active` \| `won` \| `lost`), guesses[] (countryId, range, at), maxGuesses, pointsEarned, startedAt, finishedAt | `userId` + `status` |

Store only a **hash** of verify and reset tokens, as you would a password. The raw
token exists only in the email.

## 4. Game rules (draft: confirm at the kickoff meeting)

- **Distance:** great-circle (haversine) distance between country centroids.
- **Ranges returned:** `< 500 km`, `500–1,500 km`, `1,500–3,000 km`,
  `3,000–6,000 km`, `> 6,000 km`. The client gets the range, never the exact
  target or its coordinates.
- **Guess cap:** 10 per round. Guessing the same country twice doesn't count
  against you.
- **Points:** a win scores `max(10, 100 − 10 × (guesses − 1))`. A loss scores 0.
  Points are added with an atomic `$inc` on the server, never sent from the
  client.
- **Known limitation, for the "what didn't go well" slide:** centroid distance
  makes big neighbors look far apart, such as Russia and Finland.

---

## 5. Assignments

Each person owns their area. If you need to change someone else's files, message
them first. The phases are:

- **P0** Oct 27–31, foundations
- **P1** Nov 1–4, auth and data
- **P2** Nov 5–8, gameplay
- **P3** Nov 9–11, finish and freeze
- **P4** Nov 12–15, docs, deck, submit

Most tasks are 3–5 days, so if you're blocked for a day, say so at standup that
day.

### Sam: Project Manager + Infrastructure

You own the schedule, the server, the deck, and making sure nobody is blocked.

**P0: Oct 27–31**
- [ ] **By Wed Oct 28:** commit and push the monorepo scaffold. Protect `main`:
      require a PR and one approval, and require CI to pass once it exists.
- [ ] Turn on **secret scanning and push protection** (Settings → Code security).
      It's free for public repos.
- [ ] Create a GitHub Project board with one issue per task in this file,
      assigned by name. Labels: `api`, `web`, `mobile`, `db`, `docs`.
- [ ] Kickoff meeting **Wed Oct 28**:
  - confirm assignments and the game rules (section 4)
  - pick a project name
  - set the standup time
  - everyone sets their git identity and runs `pnpm dev`
- [ ] **Rotate the small project's MySQL password and stop using `root`.** It is
      committed in that public repo's history.
- [ ] **By Fri Oct 30:** set up the droplet (Ubuntu LTS, Node 20, nginx, pm2).
      **Buy the domain today**, since DNS can take 48 hours. Point the A record
      and run `certbot --nginx` for HTTPS.
- [ ] Give Noah the droplet IP for the Atlas allowlist. Give Sebastian the domain
      for email sender authentication.
- [ ] Put the project title, repo URL and live URL in the signup spreadsheet.

**P1: Nov 1–4**
- [ ] **By Mon Nov 2:** nginx serves `apps/web/dist`, and `/api` is proxied to the
      API under pm2, on one origin. Write `docs/deploy.md` with the exact commands
      to deploy and roll back, so anyone can ship.
- [ ] **By Tue Nov 3:** turn on CI. The workflow is already in
      `.github/workflows/ci.yml` (typecheck, lint, build, test, plus Flutter
      analyze). Follow [docs/pm/ci.md](docs/pm/ci.md) to make the
      **Web + API** check required on `main`. This counts under "current
      standards."
- [ ] **By Wed Nov 4:** finish the **use case diagram**. A draft is in
      `docs/diagrams/use-case.puml`. Refine it with the team and export a PNG.

**P2: Nov 5–8**
- [ ] **By Sun Nov 8:** finish the **sequence diagram** for register → verify
      email → log in. A draft is in `docs/diagrams/sequence-register-verify.puml`.
      Check it against Sebastian's real code.
- [ ] Start the deck skeleton with every required section (see deliverables.md).
- [ ] Check the domain on **UCF campus WiFi** once now, so a block gets found
      early.

**P3: Nov 9–11**
- [ ] Collect diagrams, test screenshots and Figma exports into the deck.
- [ ] Run the feature-freeze check on **Wed Nov 11**: the full flow works on the
      live domain on web *and* mobile.

**P4: Nov 12–15**
- [ ] Finish the deck by **Fri Nov 13**.
- [ ] Post the deck in Discord **Fri night**. Get confirmation that **all five
      people have submitted it to WebCourses by Sat Nov 14**. Anyone who doesn't
      submit gets an individual zero, and the hard deadline is Sun 11:59 pm.
- [ ] Two timed run-throughs (target 11:30, hard limit 12:00).
- [ ] Put the deck and support files on a USB drive. Check the domain on campus
      WiFi **2 days and 1 day before** our slot.

**All the time**
- [ ] Daily async standup in `#standup`: done, next, blocked. Run a 20-minute
      call **Sundays** (plan the week) and **Wednesdays** (unblock).
- [ ] **Check Insights → Contributors every other day.** Anyone with no commits
      in 2 days gets a private message that day.
- [ ] Keep the Gantt current: edit `docs/pm/gantt.mjs`, then run
      `node docs/pm/gantt.mjs`. A chart that shows real slips beats a fictional one.

**Presentation (~2:00):** title, team and roles, tech stack, Gantt, what went
well and what didn't.

---

### Noah: Database + Search

You own the data and the search endpoint, worth 5 points on its own, plus the
SwaggerHub spec.

**P0: Oct 27–31**
- [ ] **By Thu Oct 29:** create a MongoDB Atlas cluster (free M0). Create an **app
      user with access to only this database**, not an admin. Allowlist the
      droplet IP and the team's IPs.
- [ ] Share the connection string by Discord DM. It goes in `.env`, never in git.
- [ ] Pick an openly licensed country dataset (Natural Earth or similar) with
      name, ISO codes, continent and centroid lat/lng. Credit it in the README.

**P1: Oct 30–Nov 4**
- [ ] **By Mon Nov 2:** write `apps/api/scripts/seed-countries.ts`, an idempotent
      import that anyone can re-run against an empty database. Include aliases
      (`USA`, `UK`, `Ivory Coast`).
- [ ] **By Tue Nov 3:**
  - Create every index from section 3 in code, not by hand in Atlas.
  - Write `docs/data-model.md` with the final collections, fields and indexes.
    Agree on it with Sebastian before he writes queries.
- [ ] Add a seed script for **pre-verified demo accounts** with some points, so
      the leaderboard isn't empty in the demo.
- [ ] **By Thu Nov 5:** build `GET /api/countries/search`. Both game screens
      depend on it.
  - Case-insensitive partial match on name *and* aliases.
  - Regex-escape the input.
  - Rank prefix matches first (`fra` → France before Central African Republic).
  - Return a limit of 10.
  - An empty `q` returns `[]`.

**P2: Nov 5–8**
- [ ] **By Sun Nov 8:** draw the **ERD** in PlantUML (`docs/diagrams/erd.puml`),
      with every collection, field type and relationship (user 1–* games,
      user 1–* tokens, game *–1 country).

**P3: Nov 6–11**
- [ ] **By Tue Nov 10:** the **SwaggerHub** spec, in OpenAPI 3, for the two
      endpoints in section 2.
  - Include request and response schemas, plus success *and* error examples.
  - Commit it to `docs/api/openapi.yaml`.
  - Point the server URL at the **live domain**.
  - Make "Try it out" work from SwaggerHub (CORS has to allow it).
- [ ] **By Wed Nov 11:** integration tests for search, using an in-memory or test
      database:
  - partial match
  - aliases
  - case-insensitivity
  - empty query
  - regex characters like `(`

**Presentation (~2:00):** ERD and data model, how the search works, the live
SwaggerHub demo. Be ready for "why is `/.*fra.*/` slow on a million rows?"
(an unanchored regex can't use an index; a prefix match can, and text and Atlas
Search indexes exist).

---

### Sebastian: API + Auth

You own the contract, authentication, email, and the game logic.

**P0: Oct 27–Nov 2**
- [ ] **By Fri Oct 30:** turn section 2 into `docs/api-contract.md` and zod
      schemas in `packages/shared`. Get a 👍 from John and Arwa before anyone
      codes against it.
- [ ] **By Mon Nov 2:** set up email sending (SendGrid, or Nodemailer + SMTP) and
      verify the sender for our domain. Write a `sendMail()` helper. **Send a
      real test email to a Gmail address and a UCF address.** Deliverability is
      the usual late surprise.

**P1: Oct 31–Nov 4**
- [ ] `register`: validate with zod, reject duplicate emails (409), hash with
      **bcrypt**, create a verify token (24h expiry), send the email.
- [ ] `verify-email` and `resend-verification`.
- [ ] `login`:
  - Return a generic "Invalid email or password" for both a bad email and a bad
    password.
  - Return **403** for an unverified account.
  - On success, return the JWT.
- [ ] `requireAuth` middleware: read `Authorization: Bearer`, attach `userId` to
      the request. Replace the course demo's token-in-body pattern.
- [ ] Remove the plaintext-password demo login and the cards endpoints.
- [ ] **All of the above live by Wed Nov 4.**

**P2: Nov 3–8**
- [ ] **By Fri Nov 6:** `forgot-password` (always 200) and `reset-password`
      (1h token, single use).
- [ ] **By Sun Nov 8:** game logic, kept server-side:
  - `POST /api/games` picks a random target and stores it.
  - `POST /api/games/:id/guesses` computes the haversine distance and range,
    detects a win, enforces the guess cap, scores, and `$inc`s the user's points.
  - Reject guesses on someone else's game or a finished one.

**P3: Nov 9–12**
- [ ] **By Tue Nov 10:** review Noah's OpenAPI spec against the real code.
- [ ] **By Wed Nov 11:** rate-limit the auth routes (`express-rate-limit`) and
      return consistent error shapes.
- [ ] **By Thu Nov 12:** API tests (Vitest + supertest), with a screenshot of the
      results in `docs/tests/`:
  - auth happy paths and every error case
  - expired and reused tokens
  - unverified login
  - guess scoring
  - can't touch another user's game

**Presentation (~2:00):** the email verification and reset flow (walk the
sequence diagram), JWT, password hashing, and the API test results.

---

### John: Web App (React + TypeScript)

You own everything a web user sees. The demo is worth 20 points.

**P0: Oct 27–31**
- [ ] **Figma web prototype:** login/register, check-your-inbox, verify result,
      forgot/reset password, game screen, win/lose, leaderboard.
- [ ] Agree on colors, fonts and spacing with Arwa, and write them in
      `docs/design.md` with the Figma link. Web and mobile must look like the
      same product.
- [ ] **Both done by Sat Oct 31.**

**P1: Nov 1–5**
- [ ] The landing route `/` is login/register (an assignment requirement).
- [ ] Add the `/verify-email` and `/reset-password` pages, which read `?token=`,
      plus forgot-password.
- [ ] A `ProtectedRoute` wrapper that redirects to `/` when logged out. This
      fixes the current logged-out crash on `/cards`.
- [ ] One API client (`fetch` wrapper) that adds the Bearer token, and logs out
      and redirects on a 401. Every call goes through it.

**P2: Nov 6–10**
- [ ] The game page:
  - The guess input **calls the search API as you type**, debounced around
    250 ms (no client-side filtering).
  - Keyboard-navigable suggestions.
  - Guesses listed closest-first, with the range color-coded.
  - Guesses-left counter.
  - Win/lose screen with points earned and a "play again" button.

**P3: Nov 9–12**
- [ ] **By Wed Nov 11:** a paginated leaderboard that highlights the current user,
      and the user's points in the header.
- [ ] **By Thu Nov 12:**
  - Responsive down to phone width.
  - Run a Lighthouse accessibility pass on the live site (labels, contrast,
    keyboard).
  - Component tests (Vitest + React Testing Library) for the login form and the
    guess input.
  - **Activity diagram** for one game round
    (`docs/diagrams/activity-game-round.puml`): type → search → pick → guess →
    feedback → win, lose, or keep guessing.

**Presentation (~2:30):** the Figma prototypes, then the live web demo: sign up,
verify, play a round, leaderboard. Rehearse the clicks.

---

### Arwa: Mobile App (Flutter) + API Support

You own the mobile app, which is half of the 20-point demo, plus two API endpoints.

**P0: Oct 27–Nov 1**
- [ ] **By Fri Oct 30:** install the Flutter SDK and an Android emulator. In
      `apps/mobile`, run `flutter create . --platforms=android,ios`, then get the
      existing login screen talking to the local API. Tell Sam the same day if
      the toolchain fights you.
- [ ] **By Sun Nov 1:** a **Figma mobile prototype** using the same design tokens
      as John.

**P1: Oct 31–Nov 8**
- [ ] **By Thu Nov 5:**
  - Login and register screens, a "check your inbox" screen, and a
    forgot-password screen (the reset itself happens on the web page from the
    email).
  - Store the JWT in `flutter_secure_storage`. Log out on a 401.
- [ ] **By Sun Nov 8:** the **API** endpoints `GET /api/users/me` and
      `GET /api/leaderboard` (paginated, using Noah's `totalPoints` index), with
      tests. You call these from mobile, so you define what you need.

**P2: Nov 6–10**
- [ ] The game screen: server-side search as you type (debounced), a guess list
      with ranges, win/lose.

**P3: Nov 9–13**
- [ ] **By Thu Nov 12:**
  - The leaderboard screen and the user's points.
  - The **class diagram** for the mobile app (`docs/diagrams/class-mobile.puml`):
    screens, the API client, models, and how they relate.
- [ ] **By Fri Nov 13:**
  - Widget tests for login and the guess flow, with a screenshot of the results.
  - A **release APK** installed on a real phone for the demo, with the live
    domain baked in (`--dart-define=API_URL=https://<domain>`).

**Presentation (~2:30):** the live mobile demo (same account as the web demo, so
the points match), and the class diagram.

---

## 6. Timeline and milestones

| Phase | Dates | Goal | Done when |
|---|---|---|---|
| P0 | Oct 27–31 | Foundations | **M1 (Sat Oct 31):** repo protected, domain on HTTPS, Atlas up, contract agreed, Flutter runs, everyone has pushed one commit |
| P1 | Nov 1–4 | Auth + data | **M2 (Wed Nov 4):** register → email → verify → login works on the **live** web app; countries seeded |
| P2 | Nov 5–8 | Gameplay | **M3 (Sun Nov 8):** search + guess endpoints live on the domain; mobile login works |
| P3 | Nov 9–11 | Finish | **M4 feature freeze (Wed Nov 11):** a full round and the leaderboard work on both apps; Swagger works live |
| P4 | Nov 12–15 | Docs, deck, submit | **M5 (Fri Nov 13):** deck, tests and diagrams done. **M6 (Sat Nov 14):** all 5 WebCourses submissions in |
| — | **Sun Nov 15, 11:59 pm** | **DUE** | Sunday is buffer only |
| — | TBD | **Present** | Our slot from the spreadsheet |

**There is no buffer week.** This is about the same length as the small project's
18 days, but with twice the surface: web, mobile, email and a game. Sunday Nov 15
is the only slack. If a milestone slips by more than a day, cut scope at the next
standup:

- **Cut first:** rate limiting, leaderboard highlighting, Lighthouse polish.
- **Never cut:** the demo flow, email verify/reset, search, SwaggerHub, the
  diagrams, or the deck.

**Nice-to-haves are out of scope.** If the freeze is met early, the only one worth
adding is stats and streaks on the profile. Skip the map, daily challenge, hints,
friends and achievements.

## 7. Ways teams lose points on this one

- **Backloaded or missing commits.** Lost points here are unrecoverable at the end.
- **Search filtered on the client.** It must hit the server on each (debounced)
  keystroke.
- **Email that only works on localhost.** Verification and reset have to work on
  the live domain.
- **The target country leaked to the client**, or points sent from the client.
  That counts as a cheat and a standards issue.
- **Demoing on localhost or a raw IP.** Both are disallowed.
- **SwaggerHub "Try it out" failing live** because of CORS or HTTP. Test it the
  day before.
- **Running over 12 minutes.** Over 13 costs 5 points, plus 5 per extra minute.
- **One person not submitting the slides to WebCourses by Sun 11:59 pm.** That's
  an individual zero.
