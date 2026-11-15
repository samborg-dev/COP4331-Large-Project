import { describe, expect, it } from "vitest";
import { savedRoundSchema } from "./round";

describe("Documented saved-round responses", () => {
  const common = { gameId: "round-1", maxGuesses: 10, guessesUsed: 1, pointsEarned: 100 };
  it("restores the country and answer from a winning round", () => {
    const round = savedRoundSchema.parse({ ...common, status: "won", answer: "France",
      guesses: [{ countryId: "FR", country: "France", range: "Correct", at: "2026-11-15T00:00:00Z" }],
    });
    expect(round).toMatchObject({ status: "won", answer: "France", pointsEarned: 100 });
    expect(round.guesses[0]).toMatchObject({ name: "France", correct: true });
  });
  it.each(["active", "lost"])("rejects an inconsistent guess count for %s", (status) => {
    expect(savedRoundSchema.safeParse({ ...common, status, guesses: [] }).success).toBe(false);
  });
  it("rejects the obsolete database response format", () => {
    expect(savedRoundSchema.safeParse({ ...common, status: "IN_PROGRESS",
      guesses: [{ countryId: "FR", guessName: "France", range: "> 6,000 km" }],
    }).success).toBe(false);
  });
});
