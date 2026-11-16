# CountryGuesser design

Web and mobile share one look: a dark background, rounded cards, blue primary buttons
and system sans-serif type. Account forms use explicit labels, keyboard focus
indicators and inline errors.

## Wireframes

Low-fidelity wireframes for every screen, built from the real screens' labels and routes. They are
generated from `docs/design/wireframes/generate.py` (edit that and re-run it), with PNG exports for the slides.

| Platform | Sheet | Screens |
|---|---|---|
| Web | [web.png](design/wireframes/web.png) ([web.svg](design/wireframes/web.svg)) | Sign in, create account, verify email, forgot and reset password, game, round over and give-up dialog, leaderboard |
| Mobile | [mobile.png](design/wireframes/mobile.png) ([mobile.svg](design/wireframes/mobile.svg)) | Log in, create account, check your inbox, forgot password, game, round over and give-up dialog, leaderboard |

If the team also has Figma prototypes, link them here: **Figma (web):** _add link_, **Figma (mobile):** _add link_.

## Design tokens

Shared by `apps/web/src/App.css` and `apps/mobile/lib/theme.dart`.

| Token | Value | Used for |
|---|---|---|
| Background | `#10141f` | Page |
| Card | `#202633` | Cards and panels |
| Input | `#151b27`, border `#465067` | Form fields |
| Primary | `#718dff` (text on it `#0c1636`) | Buttons, highlights |
| Text | `#f2f4f8`, muted `#b4bdce`, link `#9db8ff` | Copy |
| Guess ranges | Colored by distance bucket, same palette on both globes | Guess history and globe |
| Type | System sans-serif | Everything |

## Web routes

- `/` opens sign-in with a link to `/register`. `/login` also opens sign-in.
- `/guest` opens the guest view from Continue as guest.
- `/verify-email` and `/reset-password` read the token from the email link.
- `/game` requires a session. `/leaderboard` prompts guests to sign in.

## Mobile screens

Login, register, check inbox (resend), forgot password, game (with globe) and
leaderboard. See the screen table in the [README](../README.md#mobile-flutter).

## Game screen (both platforms)

- Type to search: each (debounced) keystroke calls `GET /api/countries/search`; nothing is filtered on the client.
- Enter selects the highlighted suggestion, a second Enter submits the guess.
- Each guess shows its distance range, rounded distance and compass direction, closest first.
- The globe colors and raises each guessed country and turns toward the latest guess.
- Give up asks for confirmation, then reveals the answer in green. A finished round offers Play again.
- An unfinished round survives a reload and is resumed from `GET /api/games/:id`.

## API integration

Auth types and validation come from `packages/shared`. Search, rounds and the leaderboard follow
[docs/api-contract.md](api-contract.md). The leaderboard requests one page at a time and
highlights the signed-in player.

Set `VITE_API_URL` in the root `.env` for a custom API origin; local development defaults to
`http://localhost:5000`. For deployment, use the live HTTPS origin as described in
[docs/deploy.md](deploy.md). Never put database or email credentials in `VITE_*` variables.
