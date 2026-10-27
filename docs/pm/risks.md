# Risk register

Reviewed at every Sunday sync. **Trigger** is the observable sign that a risk is
happening, and the point to act on it, not just watch it.

| # | Risk | Likelihood | Impact | Owner | Mitigation | Trigger → action |
|---|---|---|---|---|---|---|
| R1 | Commits are late or uneven (20 pts, per person) | High | High | Sam | Commit every 2 days; contributor graph checked every other day; issues assigned by name | Anyone with 0 commits in 2 days → Sam messages them that day |
| R2 | Email verification/reset doesn't deliver on the live domain (spam, unverified sender) | Med | High | Sebastian | Set up sender authentication in P0; test Gmail + UCF inboxes by Nov 2 | Test mail lands in spam or bounces → switch provider or fix DNS records the same week |
| R3 | Mobile app falls behind (half the 20-pt demo) | Med | High | Arwa | Flutter running by Oct 30; reset happens on the web, not mobile; map is out of the MVP | Mobile login not working at M3 (Nov 8) → John pairs with Arwa |
| R4 | Secrets committed to the public repo | Med | High | Everyone | `.env` gitignored; push protection on; review PR diffs for keys | Push protection alert → rotate the key immediately, then clean up |
| R5 | Domain blocked on the UCF network | Low | High | Sam | Domain live by Oct 31; campus check in P2, then 2 days and 1 day before | Blocked → contact UCF IT the same day (it takes 1–2 days) |
| R6 | Scope creep (map, daily challenge, friends) | Med | Med | Sam | Fixed MVP, no nice-to-haves; freeze Wed Nov 11 | Anything beyond the MVP started before the freeze → stop it at standup |
| R7 | SwaggerHub "Try it out" fails live (CORS, HTTP, spec drift) | Med | Med | Noah | Spec targets the live HTTPS domain; CORS allows SwaggerHub; tested by Nov 10 and the day before | Fails in rehearsal → fix CORS, or demo with the curl fallback in the notes |
| R8 | Database or droplet trouble on demo day | Low | High | Noah / Sam | Seed scripts rebuild everything; pre-verified demo accounts; `mongodump` before the presentation | Data missing → re-run seed (rehearse this once) |
| R9 | Presentation over 12 minutes | Med | Med | Sam | Run-of-show with fixed segments; 2 timed rehearsals | Rehearsal over 11:45 → cut slide content, not the demos |
| R10 | 20-day schedule with no buffer week (due Sun Nov 15, 11:59 pm) | High | High | Sam | Freeze Wed Nov 11, deck Fri Nov 13, submit Sat Nov 14; Sunday is the only slack | Any milestone more than a day late → cut scope at the next standup (rate limiting, highlight polish), never the graded items |
| R11 | Merge conflicts in shared files (`packages/shared`, lockfile) | Med | Low | Everyone | Small PRs; pull `main` daily; contract changes go through Sebastian | Lockfile conflict → take `main`'s and re-run `pnpm install` |
| R12 | Distance by centroid feels wrong for big neighbors | High | Low | Sebastian | Document as a known limitation; border distance is a stretch goal | Comes up in demo or Q&A → "what didn't go well" slide |

## Lessons from the small project (Contact Manager, Sep 2026)

Pulled from that repo's git history and files. Each one is already written into
the plan above or into TASKS.md.

**Didn't go well**
1. **Commits clustered at the end.** The first week had commits from two people.
   Some members' commits all landed in the final week, or on the due day, and
   PRs were merged up to three days after the deadline.
   → Commit every 2 days, graph checks every other day, and a feature freeze
   four days before the deadline.
2. **A real database password was committed to the public repo.** A rename turned
   the example config into the real `config.php`, and the app connected as MySQL
   `root`. → `.env` only, push protection, least-privilege Atlas user. Rotate the
   old password.
3. **Split git identities.** Several people committed under two names or emails,
   which can split or drop contribution credit. → One identity per person, using
   the email verified on GitHub.
4. **Code edited in the GitHub web UI** with default messages ("Update login.php",
   "Add files via upload"). → Work locally, typecheck before pushing, write real
   commit messages.
5. **Some assigned diagrams never reached `docs/`**, and the Swagger file sat at
   the repo root. → Every artifact has a fixed path and an owner in
   deliverables.md.
6. **No buffer week.** → This plan freezes features on Wed Nov 11 and submits
   on Sat Nov 14, a day before the deadline.

**Went well (keep doing)**
- A PR-based workflow with protected `main` (~29 PRs).
- Debounced, server-side search on every keystroke.
- A written deploy guide, so deploys weren't a single-person bottleneck.
- Lighthouse checks captured as evidence for the slides.
