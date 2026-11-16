import { describe, expect, it } from "vitest";
import { compareGuesses, guessClue, guessResponseSchema, savedRoundSchema, type Guess } from "./round";

describe("Documented saved-round responses", () => {
  const common = { gameId: "round-1", maxGuesses: 10, guessesUsed: 1, pointsEarned: 100 };

  it("keeps distance and direction in new and restored guesses", () => {
    const guess = { countryId: "FR", country: "France", range: "1,500–3,000 km", distance: 1550, direction: "NE" };
    expect(guessResponseSchema.parse({ ...guess, solved: false, guessesUsed: 1 })).toMatchObject({ distance: 1550, direction: "NE" });
    const round = savedRoundSchema.parse({ ...common, status: "active", guesses: [guess] });
    expect(round.guesses[0]).toMatchObject({ distance: 1550, direction: "NE" });
    expect(guessClue(round.guesses[0]!)).toBe("~1,550 km ↗");
  });
  it.each([-10, NaN, Infinity])("rejects invalid distance %s", distance => {
    expect(guessResponseSchema.safeParse({ country: "France", range: "< 500 km", solved: false, guessesUsed: 1, distance }).success).toBe(false);
  });
  it("sorts by distance inside the same bucket without changing the original history", () => {
    const guesses: Guess[] = [
      { countryId: "a", name: "A", range: "1,500–3,000 km", distance: 2900 },
      { countryId: "b", name: "B", range: "1,500–3,000 km", distance: 1550 },
      { countryId: "c", name: "C", range: "Correct", distance: 0, correct: true },
    ];
    expect([...guesses].sort(compareGuesses).map(g => g.countryId)).toEqual(["c", "b", "a"]);
    expect(guesses[0]?.countryId).toBe("a");
  });
  it("keeps range-only clues usable and does not hide zero kilometers", () => {
    expect(guessClue({ countryId: "a", name: "A", range: "< 500 km" })).toBe("< 500 km");
    expect(guessClue({ countryId: "a", name: "A", range: "< 500 km", distance: 0 })).toBe("~0 km");
    expect(guessClue({ countryId: "a", name: "A", range: "Correct", direction: "Correct", correct: true })).toBe("Correct country");
  });

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
