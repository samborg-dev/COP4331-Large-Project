import { z } from 'zod';

// ---- JWT ----
export const tokenPayloadSchema = z.object({
  userId: z.number(),
  firstName: z.string(),
  lastName: z.string(),
});
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

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
