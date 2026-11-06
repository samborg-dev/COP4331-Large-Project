# API Contract

All requests and responses are `application/json`.
Protected routes require `Authorization: Bearer <accessToken>`.
All errors return `{ "error": "human-readable message" }` with standard HTTP status codes (`400`, `401`, `403`, `404`, `409`, `429`, `500`).

## 1. Authentication (`/api/auth`)

### `POST /api/auth/register` (Public)
- **Request:** `{ "firstName": "string", "lastName": "string", "email": "string", "password": "string (min 8)" }`
- **Responses:**
  - `201 Created`: `{ "message": "Account created. Please check your email to verify." }`
  - `400 Bad Request`: `{ "error": "Validation error message" }`
  - `409 Conflict`: `{ "error": "Email already registered" }`

### `POST /api/auth/verify-email` (Public)
- **Request:** `{ "token": "string" }`
- **Responses:**
  - `200 OK`: `{ "message": "Email verified successfully" }`
  - `400 Bad Request`: `{ "error": "Invalid or expired verification token" }`

### `POST /api/auth/resend-verification` (Public)
- **Request:** `{ "email": "string" }`
- **Responses:**
  - `200 OK`: `{ "message": "If that account exists and is unverified, a verification link has been sent." }`

### `POST /api/auth/login` (Public)
- **Request:** `{ "email": "string", "password": "string" }`
- **Responses:**
  - `200 OK`: `{ "accessToken": "string", "user": { "id": "string", "firstName": "string", "lastName": "string", "email": "string", "totalPoints": 0 } }`
  - `401 Unauthorized`: `{ "error": "Invalid email or password" }`
  - `403 Forbidden`: `{ "error": "Account email is not verified" }`

### `POST /api/auth/forgot-password` (Public)
- **Request:** `{ "email": "string" }`
- **Responses:**
  - `200 OK`: `{ "message": "If an account with that email exists, a password reset link has been sent." }`

### `POST /api/auth/reset-password` (Public)
- **Request:** `{ "token": "string", "password": "string (min 8)" }`
- **Responses:**
  - `200 OK`: `{ "message": "Password reset successfully" }`
  - `400 Bad Request`: `{ "error": "Invalid or expired reset token" }`

## 2. Gameplay (`/api/games`)

### `POST /api/games` (Bearer Auth)
- **Responses:**
  - `201 Created`: `{ "gameId": "string", "maxGuesses": 10 }`

### `GET /api/games/:id` (Bearer Auth)
- **Responses:**
  - `200 OK`: `{ "gameId": "string", "status": "active | won | lost", "guesses": [{ "countryId": "string", "country": "string", "range": "< 500 km | 500–1,500 km | 1,500–3,000 km | 3,000–6,000 km | > 6,000 km", "at": "ISO-8601" }], "maxGuesses": 10, "guessesUsed": 1, "pointsEarned": 0 }`
  - `403 Forbidden`: `{ "error": "Cannot access another user's game" }`
  - `404 Not Found`: `{ "error": "Game not found" }`

### `POST /api/games/:id/guesses` (Bearer Auth)
- **Request:** `{ "countryId": "string" }`
- **Responses:**
  - `200 OK`: `{ "country": "France", "range": "1,500–3,000 km", "solved": false, "guessesUsed": 1, "pointsEarned": 90 }` (`pointsEarned` included when `solved: true`)
  - `400 Bad Request`: `{ "error": "Game is already finished" }`
  - `403 Forbidden`: `{ "error": "Cannot guess on another user's game" }`

## 3. Users, Search & Leaderboard

### `GET /api/users/me` (Bearer Auth)
- **Response `200 OK`:** `{ "id": "string", "firstName": "string", "lastName": "string", "email": "string", "totalPoints": 0, "gamesPlayed": 0, "gamesWon": 0 }`

### `GET /api/countries/search?q=fra&limit=10` (Bearer Auth)
- **Response `200 OK`:** `[{ "id": "string", "name": "France", "iso2": "FR", "iso3": "FRA", "continent": "Europe" }]`

### `GET /api/leaderboard?page=1&limit=20` (Bearer Auth)
- **Response `200 OK`:** `{ "entries": [{ "rank": 1, "userId": "string", "firstName": "string", "lastName": "string", "totalPoints": 250, "gamesWon": 3 }], "page": 1, "limit": 20, "total": 1 }`
