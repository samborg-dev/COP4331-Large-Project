# CountryGuesser design

Web and mobile share one look: a dark background, rounded cards, blue primary buttons
and system sans-serif type. Account forms use explicit labels, keyboard focus
indicators and inline errors.

## Prototypes (Figma)

| Platform | Figma link | Frames |
|---|---|---|
| Web | **TODO (John): paste the Figma link and export PNGs to `docs/design/`** | Login/register, check inbox, verify result, forgot/reset password, game, win/lose, leaderboard |
| Mobile | **TODO (Arwa): paste the Figma link and export PNGs to `docs/design/`** | Login, register, check inbox, forgot password, game, leaderboard |

The prototypes are a graded item (5 points) and have to appear in the slides. The built
screens are described below and match the tokens here.

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
