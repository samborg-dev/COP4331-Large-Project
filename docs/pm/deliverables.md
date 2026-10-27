# Deliverables checklist

Every graded or required item, who owns it, when it's due, and where the evidence
lives. Sam updates the **Done** column at the Sunday and Wednesday syncs. Task
detail is in [TASKS.md](../../TASKS.md) and dates are in [gantt.md](gantt.md).

**Hard deadline: Sun Nov 15, 11:59 pm (WebCourses).** Internal dates leave Sunday
as the only buffer.

## Rubric (100 points)

| # | Deliverable | Pts | Owner | Due | Evidence / location | Done |
|---|---|---|---|---|---|---|
| 1 | PowerPoint submitted on time, **by each member** | 5 | Everyone | Sat Nov 14 (hard: Sun Nov 15, 11:59 pm) | WebCourses submission (5 confirmations in Discord) | ☐ |
| 2 | Professional slides | 5 | Sam | Fri Nov 13 | `.pptx` on USB + in Discord | ☐ |
| 3 | All members participate | 5 | Everyone | Presentation | Run-of-show below | ☐ |
| 4 | Gantt chart | 5 | Sam | Kept current, final Nov 13 | `docs/pm/gantt.svg` | ☐ |
| 5 | ERD | 5 | Noah | Sun Nov 8 | `docs/diagrams/erd.puml` + PNG | ☐ |
| 6a | Use case diagram | 5 (shared) | Sam | Wed Nov 4 | `docs/diagrams/use-case.puml` (draft exists) | ☐ |
| 6b | Sequence diagram | ″ | Sam | Sun Nov 8 | `docs/diagrams/sequence-register-verify.puml` (draft exists) | ☐ |
| 6c | Activity diagram | ″ | John | Thu Nov 12 | `docs/diagrams/activity-game-round.puml` | ☐ |
| 7 | Email verification and password recovery | 5 | Sebastian | Fri Nov 6 | Works on the live domain | ☐ |
| 8 | SwaggerHub demo (exactly 2 endpoints, ≥1 live) | 5 | Noah (spec), Sebastian (review) | Tue Nov 10 | `docs/api/openapi.yaml` + SwaggerHub link | ☐ |
| 9 | Server-side partial-match search | 5 | Noah | Thu Nov 5 | `GET /api/countries/search` + tests | ☐ |
| 10 | Prototypes (web **and** mobile) | 5 | John (web), Arwa (mobile) | Sat Oct 31 / Sun Nov 1 | Figma links in `docs/design.md` + exports | ☐ |
| 11 | Working demo: web | 20 (shared) | John + Sebastian | Wed Nov 11 | `https://<domain>` | ☐ |
| 11 | Working demo: mobile | ″ | Arwa | Wed Nov 11 (APK Fri Nov 13) | Release APK on a real phone | ☐ |
| 12 | Adherence to current standards | 5 | Everyone | Ongoing | HTTPS, bcrypt, JWT, hashed reset tokens, rate limiting, CI, typed contract, no secrets in git | ☐ |
| 13 | Instructor discretionary excellence | 5 | Everyone | — | Ideas: debounced server search, server-side scoring (anti-cheat), CI badge, shared zod contract, polished matching UI | ☐ |
| 14 | GitHub contribution (per person) | 20 | Everyone | Every 2 days | Insights → Contributors, PR reviews | ☐ |

## Other required items (in the slides, not separately scored)

| Deliverable | Owner | Due | Location | Done |
|---|---|---|---|---|
| Class diagram (mobile) | Arwa | Thu Nov 12 | `docs/diagrams/class-mobile.puml` | ☐ |
| Unit + integration test results: API | Sebastian | Thu Nov 12 | `docs/tests/api.png` | ☐ |
| Test results: search / DB | Noah | Wed Nov 11 | `docs/tests/search.png` | ☐ |
| Test results: web | John | Thu Nov 12 | `docs/tests/web.png` | ☐ |
| Test results: mobile | Arwa | Fri Nov 13 | `docs/tests/mobile.png` | ☐ |
| API contract | Sebastian | Fri Oct 30 | `docs/api-contract.md` + `packages/shared` | ☐ |
| Data model | Noah | Tue Nov 3 | `docs/data-model.md` | ☐ |
| Deploy guide | Sam | Mon Nov 2 | `docs/deploy.md` | ☐ |

## Slide outline

| # | Slide | Content from | Presenter |
|---|---|---|---|
| 1 | Title: what the project is | Sam | Sam |
| 2 | Team members and their parts | Sam | Sam |
| 3 | Technology (MongoDB, Express, React/TS, Flutter, Tailwind, JWT, SendGrid, DigitalOcean, GitHub, Discord, Figma, PlantUML) | Sam | Sam |
| 4 | Gantt chart | Sam | Sam |
| 5 | Use case diagram | Sam | Sam |
| 6 | ERD | Noah | Noah |
| 7 | Search + **SwaggerHub live demo** | Noah | Noah |
| 8 | Sequence diagram: register → verify → login | Sam / Sebastian | Sebastian |
| 9 | Security: JWT, bcrypt, hashed tokens | Sebastian | Sebastian |
| 10 | Unit + integration test results | Everyone | Sebastian |
| 11 | Prototypes / wireframes | John + Arwa | John |
| 12 | Activity diagram: a game round | John | John |
| 13 | **Web demo** | John | John |
| 14 | Class diagram (mobile) | Arwa | Arwa |
| 15 | **Mobile demo** | Arwa | Arwa |
| 16 | What went well / what didn't | Everyone | Sam |
| 17 | Questions | — | Everyone |

## Run of show (12:00 hard limit; aim for 11:30)

| Time | Who | Covers |
|---|---|---|
| 0:00–2:00 | Sam | Title, team, tech stack, Gantt, use case |
| 2:00–4:00 | Noah | ERD, search design, SwaggerHub live call |
| 4:00–6:00 | Sebastian | Email verification/reset sequence, security, test results |
| 6:00–8:30 | John | Prototypes, activity diagram, live web demo |
| 8:30–11:00 | Arwa | Class diagram, live mobile demo (same account; points match web) |
| 11:00–11:30 | Sam | What went well / didn't, thanks, questions |

**Demo prep:** use pre-verified demo accounts seeded by Noah. Keep a backup screen
recording of both demos on the USB in case the network fails.

## Admin and submission

- [ ] Signup spreadsheet: project title, GitHub URL, **live URL**. Sam, by Sat Oct 31.
- [ ] Presentation date/time recorded once assigned. Sam.
- [ ] Deck posted in Discord Fri Nov 13. Every member submits the `.pptx` to
      WebCourses and posts ✅ by **Sat Nov 14** (hard deadline Sun Nov 15, 11:59 pm).
- [ ] Domain checked on UCF campus network: once in P2 (Nov 5–8), then **2 days and
      1 day before** the slot. Sam.
- [ ] USB drive with the deck, diagram PNGs, demo recordings and the APK. Sam.
- [ ] Two timed full rehearsals with all five people. Sam.
