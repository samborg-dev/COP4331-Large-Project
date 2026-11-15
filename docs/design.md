# CountryGuesser web design

The web app uses a dark background (#10141f), rounded cards (#202633), blue primary buttons (#718dff), and system sans-serif type. Account forms use explicit labels, keyboard focus indicators, and inline errors. Confirm the shared design with Arwa.

## Web routes

- / opens sign-in with a link to /register. /login also opens sign-in.
- /guest opens the guest view from Continue as guest.
- /verify-email and /reset-password read the token from the email link.
- /game requires a session. /leaderboard prompts guests to sign in.

## API integration

The frontend uses the auth types and validation requirements in packages/shared. Search, rounds, and leaderboard follow the API contract proposed in PR #6. Country search returns an array with id and name; selecting a result submits its id as countryId. The leaderboard requests individual pages and uses the server's ranks and the signed-in user's id.

Set VITE_API_URL in the root .env for a custom API origin. Local development defaults to localhost:5000. For deployment, use the team's live HTTPS origin as described in docs/deploy.md. Never put database or email credentials in VITE_* variables.

Verify register, verify email, sign in, start round, submit guess, play again, and view leaderboard against the deployed API when the team routes are available. On the reviewed main commit (57e764a), the legacy card API is still the only app API wired into Express. Automated tests exercise the frontend with mocked server responses.
