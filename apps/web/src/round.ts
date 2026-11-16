import type { DistanceRange, GuessDirection } from "@cop4331/shared";
import { z } from "zod";

const distanceRanges = [
  "< 500 km",
  "500–1,500 km",
  "1,500–3,000 km",
  "3,000–6,000 km",
  "> 6,000 km",
] as const satisfies readonly DistanceRange[];

const guessDetails = {
  distance: z.number().finite().nonnegative().optional(),
  direction: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW", "Correct"]).optional(),
};

export const startRoundSchema = z.object({
  gameId: z.string().min(1),
  maxGuesses: z.number().int().positive(),
});

export const guessResponseSchema = z
  .object({
    country: z.string().min(1),
    range: z.enum(distanceRanges).or(z.literal("Correct")),
    ...guessDetails,
    solved: z.boolean(),
    guessesUsed: z.number().int().positive(),
    pointsEarned: z.number().int().nonnegative().optional(),
  })
  .refine((guess) => guess.solved || guess.range !== "Correct");

export const resumeRoundSchema = z.object({
  gameId: z.string().min(1),
  status: z.enum(["active", "won", "lost"]),
  maxGuesses: z.number().int().positive(),
  guessesUsed: z.number().int().nonnegative(),
  guesses: z.array(
    z.object({
      countryId: z.string().min(1),
      country: z.string().min(1),
      range: z.enum(distanceRanges).or(z.literal("Correct")),
      ...guessDetails,
    }),
  ),
  pointsEarned: z.number().int().nonnegative().optional(),
  answer: z.string().min(1).optional(),
  surrendered: z.boolean().optional(),
});

export type Guess = {
  countryId: string;
  name: string;
  range: DistanceRange | "Correct";
  correct?: boolean;
  distance?: number;
  direction?: GuessDirection;
};
export type Round = {
  gameId: string;
  status: "active" | "won" | "lost";
  maxGuesses: number;
  guessesUsed: number;
  guesses: Guess[];
  pointsEarned?: number;
  answer?: string;
  surrendered?: boolean;
};

// Translate the documented API response into the UI's round shape.
export const savedRoundSchema = resumeRoundSchema
  .refine((game) => game.guessesUsed === game.guesses.length)
  .transform((game): Round => ({
    ...game,
    guesses: game.guesses.map((guess, index) => ({
      countryId: guess.countryId,
      name: guess.country,
      range: guess.range,
      distance: guess.distance,
      direction: guess.direction,
      correct: guess.range === "Correct" || (game.status === "won" && index === game.guesses.length - 1),
    })),
  }));

export function guessesLeft(round: Round) {
  return Math.max(0, round.maxGuesses - round.guessesUsed);
}

export function guessRank(guess: Guess) {
  return guess.correct || guess.range === "Correct"
    ? -1
    : distanceRanges.indexOf(guess.range);
}

export function compareGuesses(a: Guess, b: Guess) {
  if (guessRank(a) === -1 || guessRank(b) === -1) return guessRank(a) - guessRank(b);
  return a.distance !== undefined && b.distance !== undefined
    ? a.distance - b.distance : guessRank(a) - guessRank(b);
}

const arrows: Record<GuessDirection, string> = {
  N: "↑", NE: "↗", E: "→", SE: "↘", S: "↓", SW: "↙", W: "←", NW: "↖", Correct: "",
};
export function guessClue(guess: Guess, { showDirection = true }: { showDirection?: boolean } = {}) {
  if (guess.correct || guess.range === "Correct") return "Correct country";
  const distance = guess.distance === undefined ? guess.range : `~${guess.distance.toLocaleString("en-US")} km`;
  const arrow = showDirection && guess.direction ? arrows[guess.direction] : "";
  return arrow ? `${distance} ${arrow}` : distance;
}
