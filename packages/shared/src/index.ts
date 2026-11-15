import { z } from 'zod';

// [Section 2] Consistent error shape: { "error": "human-readable message" }
export interface ApiErrorResponse {
  error: string;
}

// [Section 4 - Game rules] Exact 5 distance range buckets
export type DistanceRange =
  | '< 500 km'
  | '500–1,500 km'
  | '1,500–3,000 km'
  | '3,000–6,000 km'
  | '> 6,000 km';

// [P1 - register] Validate with zod
export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// [P1 - verify-email] { token } from email link
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// [P1 - resend-verification] & [P2 - forgot-password] { email }
export const emailOnlySchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

// [P1 - login] Returns { accessToken, user }; 403 if not verified
export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthUserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  totalPoints: number;
}

export interface AuthLoginResponse {
  accessToken: string;
  user: AuthUserResponse;
}

// [P2 - reset-password] { token, password }
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// [P2 - POST /api/games] Start a round; returns { gameId, maxGuesses }, never the target
export interface StartGameResponse {
  gameId: string;
  maxGuesses: number;
}

// [P2 - GET /api/games/:id] Resume a round (guesses so far, status)
export interface GameGuessRecord {
  countryId: string;
  country: string;
  range: DistanceRange;
  at: string;
}

export interface GetGameResponse {
  gameId: string;
  status: 'active' | 'won' | 'lost';
  guesses: GameGuessRecord[];
  maxGuesses: number;
  guessesUsed: number;
  pointsEarned: number;
}

// [P2 - POST /api/games/:id/guesses] { countryId } -> { country, range, solved, guessesUsed, pointsEarned? }
export const submitGuessSchema = z.object({
  countryId: z.string().min(1, 'countryId is required'),
});
export type SubmitGuessInput = z.infer<typeof submitGuessSchema>;

export interface SubmitGuessResponse {
  country: string;
  range: DistanceRange;
  solved: boolean;
  guessesUsed: number;
  pointsEarned?: number;
}

// [Section 2 - Contract Owner] Shared schemas for endpoints in Section 2 table
export const searchCountriesQuerySchema = z.object({
  q: z.string().default(''),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- Legacy Demo Scaffolding (Keep only until John removes CardPage from apps/web) ----
export const tokenPayloadSchema = z.object({
  userId: z.number(),
  firstName: z.string(),
  lastName: z.string(),
});
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
export const loginRequestSchema = z.object({ login: z.string().min(1), password: z.string().min(1) });
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export interface LoginResponse { accessToken?: string; error?: string; }
export const addCardRequestSchema = z.object({ userId: z.number(), card: z.string().min(1), jwtToken: z.string() });
export type AddCardRequest = z.infer<typeof addCardRequestSchema>;
export interface AddCardResponse { error: string; jwtToken: { accessToken: string } | null; }
export const searchCardsRequestSchema = z.object({ userId: z.number(), search: z.string(), jwtToken: z.string() });
export type SearchCardsRequest = z.infer<typeof searchCardsRequestSchema>;
export interface SearchCardsResponse { results: string[]; error: string; jwtToken: { accessToken: string } | null; }