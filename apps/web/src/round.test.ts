import { describe, expect, it } from "vitest";
import { savedRoundSchema } from "./round";

describe("Documented saved-round responses", () => {
  const common = { gameId: "round-1", maxGuesses: 10, guessesUsed: 1, pointsEarned: 100 };

  it("restores the documented response and recognizes a winning guess", () => {
    const round = savedRoundSchema.parse({
      ...common, status: "won", answer: "France",
      guesses: [{ countryId: "FR", country: "France", range: "Correct", at: "2026-11-15T00:00:00Z" }],
    });
    expect(round.status).toBe("won");
    expect(round.answer).toBe("France");
    expect(round.guesses[0]).toMatchObject({ name: "France", correct: true });
  });

  it("restores a surrendered result", () => {
    const round = savedRoundSchema.parse({
      ...common, status: "lost", answer: "Japan", surrendered: true, pointsEarned: 0,
      guesses: [{ countryId: "FR", country: "France", range: "> 6,000 km", at: "2026-11-15T00:00:00Z" }],
    });
    expect(round).toMatchObject({ status: "lost", answer: "Japan", surrendered: true, pointsEarned: 0 });
  });

  it.each(["active", "lost"])("rejects an inconsistent guess count for %s", (status) => {
    expect(savedRoundSchema.safeParse({ ...common, status, guesses: [] }).success).toBe(false);
  });
  it("rejects database field names in the public response", () => {
    expect(savedRoundSchema.safeParse({ ...common, status: "IN_PROGRESS", guesses: [
      { countryId: "FR", guessName: "France", range: "> 6,000 km" },
    ] }).success).toBe(false);
  });
});
