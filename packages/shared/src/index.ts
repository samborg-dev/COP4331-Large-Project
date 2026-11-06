import { z } from 'zod';

// ---- JWT ----
export const tokenPayloadSchema = z.object({
  // number for the course demo's Users collection, ObjectId hex string for `users`
  userId: z.union([z.number(), z.string()]),
  firstName: z.string(),
  lastName: z.string(),
});
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

// Every /api/auth/* error: real HTTP status + { error }
export interface ErrorResponse {
  error: string;
}

export interface MessageResponse {
  message: string;
}

const emailField = z.string().trim().toLowerCase().email('Enter a valid email');
const newPasswordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  // bcrypt ignores everything past 72 bytes
  .max(72, 'Password must be at most 72 characters');

// ---- POST /api/auth/register ----  201 MessageResponse | 400 | 409
export const registerRequestSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: emailField,
  password: newPasswordField,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

// ---- POST /api/auth/verify-email ----  200 MessageResponse | 400
export const verifyEmailRequestSchema = z.object({ token: z.string().min(1) });
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

// ---- POST /api/auth/resend-verification, /api/auth/forgot-password ----  always 200
export const emailRequestSchema = z.object({ email: emailField });
export type EmailRequest = z.infer<typeof emailRequestSchema>;

// ---- POST /api/auth/reset-password ----  200 MessageResponse | 400
export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: newPasswordField,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

// ---- POST /api/auth/login ----  200 AuthLoginResponse | 400 | 401 | 403 (unverified)
export const authLoginRequestSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  totalPoints: number;
}

export interface AuthLoginResponse {
  accessToken: string;
  user: AuthUser;
}

// ---- POST /api/login ----
export const loginRequestSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// success: { accessToken }, failure: { error }
export interface LoginResponse {
  accessToken?: string;
  error?: string;
}

// ---- POST /api/addcard ----
export const addCardRequestSchema = z.object({
  userId: z.number(),
  card: z.string().min(1),
  jwtToken: z.string(),
});
export type AddCardRequest = z.infer<typeof addCardRequestSchema>;

export interface AddCardResponse {
  error: string;
  jwtToken: { accessToken: string } | null;
}

// ---- POST /api/searchcards ----
export const searchCardsRequestSchema = z.object({
  userId: z.number(),
  search: z.string(),
  jwtToken: z.string(),
});
export type SearchCardsRequest = z.infer<typeof searchCardsRequestSchema>;

export interface SearchCardsResponse {
  results: string[];
  error: string;
  jwtToken: { accessToken: string } | null;
}
