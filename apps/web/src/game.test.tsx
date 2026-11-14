import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { GuessHistory, RoundResult } from "./components/RoundUI";
import { guessesLeft, type Round } from "./round";
import { GamePage } from "./pages/GamePage";
import { LeaderboardPage, Rankings } from "./pages/LeaderboardPage";

vi.mock("./env", () => ({ env: { VITE_API_URL: "http://localhost:5000" } }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const round: Round = {
  gameId: "game-1",
  status: "active",
  maxGuesses: 10,
  guessesUsed: 3,
  guesses: [
    { countryId: "CA", name: "Canada", range: "3,000–6,000 km" },
    { countryId: "FR", name: "France", range: "500–1,500 km" },
    { countryId: "ES", name: "Spain", range: "< 500 km" },
  ],
};

describe("Round screens", () => {
  it("restores the current round after loading the game page", async () => {
    localStorage.setItem("token_data", "test-token");
    localStorage.setItem("current_game_id", "game-1");
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        gameId: "game-1",
        status: "active",
        maxGuesses: 10,
        guessesUsed: 1,
        guesses: [
          {
            countryId: "ca",
            country: "Canada",
            range: "3,000–6,000 km",
          },
        ],
        pointsEarned: 0,
      }),
    );
    vi.stubGlobal("fetch", fetcher);

    render(
      <MemoryRouter>
        <GamePage player={{ name: "John" }} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Canada")).toBeTruthy();
    expect(fetcher.mock.calls[0]).toEqual([
      "http://localhost:5000/api/games/game-1",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
      }),
    ]);
  });

  it("sorts closest-first without changing submission order", () => {
    render(<GuessHistory round={round} />);
    expect(
      screen.getAllByRole("listitem").map((row) => row.textContent),
    ).toEqual(["Spain< 500 km", "France500–1,500 km", "Canada3,000–6,000 km"]);
    expect(round.guesses[0].name).toBe("Canada");
    expect(screen.getByText("7 guesses left")).toBeTruthy();
  });

  it("uses the server's guess count and clamps it at zero", () => {
    expect(guessesLeft({ ...round, guessesUsed: 11 })).toBe(0);
  });

  it("shows a loss and awards zero points", () => {
    render(
      <RoundResult
        round={{ ...round, status: "lost", guessesUsed: 10 }}
        onPlayAgain={() => {}}
      />,
    );
    expect(screen.getByText("Out of guesses")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("starts a real round request, submits the selected country id, and starts another round", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ gameId: "game-1", maxGuesses: 10 }),
      )
      .mockResolvedValueOnce(
        Response.json([{ id: "pt", name: "Portugal", iso2: "PT" }]),
      )
      .mockResolvedValueOnce(
        Response.json({
          country: "Portugal",
          solved: true,
          range: "< 500 km",
          guessesUsed: 1,
          pointsEarned: 100,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ gameId: "game-2", maxGuesses: 10 }),
      );
    vi.stubGlobal("fetch", fetcher);
    localStorage.setItem("token_data", "test-token");
    render(
      <MemoryRouter>
        <GamePage player={{ name: "John", totalPoints: 0 }} />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start round" }));
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(document.activeElement).toBe(input));
    await user.type(input, "port");
    await user.click(await screen.findByRole("option", { name: "Portugal" }));
    expect(await screen.findByText("You found it!")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Play again" }),
      ),
    );
    expect(fetcher.mock.calls[2]).toEqual([
      "http://localhost:5000/api/games/game-1/guesses",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ countryId: "pt" }),
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    ]);
    expect(screen.getByText("John · 100 pts")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(await screen.findByText("10 guesses left")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("combobox")),
    );
    expect(screen.queryByText("You found it!")).toBeNull();
  });
});

describe("Rankings", () => {
  it("loads the requested page from the server and highlights the signed-in player", async () => {
    const payload = btoa(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    );
    localStorage.setItem("token_data", "e30." + payload + ".signature");
    localStorage.setItem(
      "user_data",
      JSON.stringify({ id: "john", firstName: "John" }),
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          entries: [
            {
              rank: 1,
              userId: "other",
              firstName: "Other",
              lastName: "Player",
              totalPoints: 200,
            },
          ],
          page: 1,
          limit: 20,
          total: 21,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          entries: [
            {
              rank: 21,
              userId: "john",
              firstName: "John",
              lastName: "Player",
              totalPoints: 100,
            },
          ],
          page: 2,
          limit: 20,
          total: 21,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    const pageLabel = await screen.findByText("Page 2 of 2");
    await waitFor(() => expect(document.activeElement).toBe(pageLabel));
    const row = screen.getByText("You").closest("tr");
    expect(row?.className).toBe("current-player");
    expect(within(row!).getByText("21")).toBeTruthy();
    expect(fetcher.mock.calls[1][0]).toBe(
      "http://localhost:5000/api/leaderboard?page=2&limit=20",
    );
  });

  it("has an empty state and disables paging without entries", () => {
    render(
      <Rankings
        data={{ entries: [], page: 1, limit: 20, total: 0 }}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("No rankings to show yet.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
