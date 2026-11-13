import type { DistanceRange } from "@cop4331/shared";
import { z } from "zod";

const distanceRanges = [
  "< 500 km",
  "500–1,500 km",
  "1,500–3,000 km",
  "3,000–6,000 km",
  "> 6,000 km",
] as const satisfies readonly DistanceRange[];

export const startRoundSchema = z.object({
  gameId: z.string().min(1),
  maxGuesses: z.number().int().positive(),
});

export const guessResponseSchema = z
  .object({
    country: z.string().min(1),
    range: z.enum(distanceRanges).or(z.literal("Correct")),
    solved: z.boolean(),
    guessesUsed: z.number().int().positive(),
    pointsEarned: z.number().int().nonnegative().optional(),
  })
  .refine((guess) => guess.solved || guess.range !== "Correct");

export type Guess = {
  countryId: string;
  name: string;
  range: DistanceRange | "Correct";
  correct?: boolean;
};
export type Round = {
  gameId: string;
  status: "active" | "won" | "lost";
  maxGuesses: number;
  guessesUsed: number;
  guesses: Guess[];
  pointsEarned?: number;
  answer?: string;
};

// Translate the saved-game response from the API into the UI's round shape.
export const savedRoundSchema = z.object({
  gameId: z.string().min(1),
  status: z.enum(["IN_PROGRESS", "WON", "LOST"]),
  maxGuesses: z.number().int().positive(),
  guessesUsed: z.number().int().nonnegative(),
  guesses: z.array(z.object({
    countryId: z.string().min(1),
    guessName: z.string().min(1),
    range: z.enum(distanceRanges),
  })),
  pointsEarned: z.number().int().nonnegative().optional(),
  targetCountry: z.string().optional(),
}).refine((game) => game.guessesUsed === game.guesses.length)
  .transform((game): Round => ({
    gameId: game.gameId,
    status: game.status === "IN_PROGRESS" ? "active" : game.status === "WON" ? "won" : "lost",
    maxGuesses: game.maxGuesses,
    guessesUsed: game.guessesUsed,
    guesses: game.guesses.map((guess, index) => ({
      countryId: guess.countryId,
      name: guess.guessName,
      range: guess.range,
      correct: game.status === "WON" && index === game.guesses.length - 1,
    })),
    pointsEarned: game.pointsEarned,
    answer: game.status === "IN_PROGRESS" ? undefined : game.targetCountry,
  }));

export function guessesLeft(round: Round) {
  return Math.max(0, round.maxGuesses - round.guessesUsed);
}

export function guessRank(guess: Guess) {
  return guess.correct || guess.range === "Correct"
    ? -1
    : distanceRanges.indexOf(guess.range);
}
