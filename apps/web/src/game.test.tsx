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
import { savedRoundKey } from "./api";
import { GamePage, GameSessionProvider } from "./pages/GamePage";
import App from "./App";
import { StrictMode } from "react";
import { LeaderboardPage, Rankings } from "./pages/LeaderboardPage";

vi.mock("./env", () => ({ env: { VITE_API_URL: "http://localhost:5000" } }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
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

function signedInPlayer(firstName = "John", totalPoints = 0) {
  const user = { id: firstName.toLowerCase(), firstName, lastName: "Player", totalPoints };
  const token = `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, userId: user.id }))}.signature`;
  return { accessToken: token, user };
}

function keepLogin() {
  const login = signedInPlayer();
  localStorage.setItem("token_data", login.accessToken);
  localStorage.setItem("user_data", JSON.stringify(login.user));
  return login.accessToken;
}

describe("Round screens", () => {
  it.each([false, true])("finishes a loss and fetches its answer (lookup fails: %s)", async (lookupFails) => {
    keepLogin();
    window.history.replaceState(null, "", "/game");
    const fetcher = vi.fn((url: string) => {
      if (url.endsWith("/api/games")) return Promise.resolve(Response.json({ gameId: "last-guess", maxGuesses: 1 }));
      if (url.includes("countries/search")) return Promise.resolve(Response.json([{ id: "FR", name: "France" }]));
      if (url.endsWith("/guesses")) return Promise.resolve(Response.json({ country: "France", range: "> 6,000 km", solved: false, guessesUsed: 1 }));
      if (url.endsWith("games/last-guess")) {
        if (lookupFails) return Promise.reject(new TypeError("Offline"));
        return Promise.resolve(Response.json({ gameId: "last-guess", status: "LOST", maxGuesses: 1, guessesUsed: 1, guesses: [{ countryId: "FR", guessName: "France", range: "> 6,000 km" }], targetCountry: "Mauritius", pointsEarned: 0 }));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole("combobox"), "fra");
    await user.click(await screen.findByRole("option", { name: "France" }));
    expect(await screen.findByText("Out of guesses")).toBeTruthy();
    if (lookupFails) expect((await screen.findByRole("alert")).textContent).toContain("answer could not be loaded");
    else expect(await screen.findByText("Mauritius")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Play again" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText("0 guesses left")).toBeTruthy();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/api/games"))).toHaveLength(1);
  });

  it("automatically starts just one round, including under StrictMode", async () => {
    keepLogin();
    window.history.replaceState(null, "", "/game");
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ gameId: "auto-round", maxGuesses: 6 })));
    vi.stubGlobal("fetch", fetcher);
    render(<StrictMode><App /></StrictMode>);
    await screen.findByRole("combobox");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Play again" })).toBeNull();
  });

  it("does not start games for guests", () => {
    window.history.replaceState(null, "", "/guest");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Play again" })).toBeNull();
  });

  it("offers a manual retry after a failed automatic start", async () => {
    keepLogin();
    window.history.replaceState(null, "", "/game");
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError("Offline"))
      .mockResolvedValueOnce(Response.json({ gameId: "retry-round", maxGuesses: 6 }));
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    const retry = await screen.findByRole("button", { name: "Try starting round again" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await userEvent.click(retry);
    await screen.findByRole("combobox");
    expect(fetcher).toHaveBeenCalledTimes(2);
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
    const token = keepLogin();
    render(
      <MemoryRouter>
        <GameSessionProvider>
          <GamePage player={{ name: "John", totalPoints: 0 }} />
        </GameSessionProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await screen.findByRole("combobox");
    const input = await screen.findByRole("combobox");
    expect(localStorage.getItem(savedRoundKey("john"))).toBe("game-1");
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
          Authorization: `Bearer ${token}`,
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

describe("Game navigation", () => {
  const emptyRankings = { entries: [], page: 1, limit: 20, total: 0 };

  it("keeps an in-flight guess and the same round when visiting the leaderboard", async () => {
    keepLogin();
    window.history.replaceState(null, "", "/game");
    let finishGuess!: (response: Response) => void;
    const guessResponse = new Promise<Response>((resolve) => { finishGuess = resolve; });
    const fetcher = vi.fn((url: string) => {
      if (url.endsWith("/api/games")) return Promise.resolve(Response.json({ gameId: "saved-round", maxGuesses: 10 }));
      if (url.includes("countries/search")) return Promise.resolve(Response.json([{ id: "fr", name: "France" }]));
      if (url.endsWith("/guesses")) return guessResponse;
      if (url.includes("leaderboard?")) return Promise.resolve(Response.json(emptyRankings));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole("combobox");
    await user.type(await screen.findByRole("combobox"), "fra");
    await user.click(await screen.findByRole("option", { name: "France" }));
    await user.click(screen.getByRole("link", { name: "Leaderboard" }));
    await screen.findByText("No rankings to show yet.");
    await user.click(screen.getByRole("link", { name: "Back to game" }));
    expect((screen.getByRole("combobox") as HTMLInputElement).disabled).toBe(true);
    finishGuess(Response.json({ country: "France", range: "500–1,500 km", solved: false, guessesUsed: 1 }));
    expect(await screen.findByText("9 guesses left")).toBeTruthy();
    expect(screen.getByText("France")).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Leaderboard" }));
    await user.click(screen.getByRole("link", { name: "Back to game" }));
    expect(screen.getByText("France")).toBeTruthy();
    expect(screen.getByText("9 guesses left")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start round" })).toBeNull();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/api/games"))).toHaveLength(1);
  });

  it("keeps the win and points on return, then clears the round for another login", async () => {
    keepLogin();
    window.history.replaceState(null, "", "/game");
    const fetcher = vi.fn((url: string) => {
      if (url.endsWith("/api/games")) return Promise.resolve(Response.json({ gameId: "won-round", maxGuesses: 10 }));
      if (url.includes("countries/search")) return Promise.resolve(Response.json([{ id: "pt", name: "Portugal" }]));
      if (url.endsWith("/guesses")) return Promise.resolve(Response.json({ country: "Portugal", range: "Correct", solved: true, guessesUsed: 1, pointsEarned: 100 }));
      if (url.includes("leaderboard?")) return Promise.resolve(Response.json(emptyRankings));
      if (url.endsWith("auth/login")) return Promise.resolve(Response.json(signedInPlayer("Other", 50)));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole("combobox");
    await user.type(await screen.findByRole("combobox"), "port");
    await user.click(await screen.findByRole("option", { name: "Portugal" }));
    await screen.findByText("You found it!");
    await user.click(screen.getByRole("link", { name: "Leaderboard" }));
    await user.click(screen.getByRole("link", { name: "Back to game" }));
    expect(screen.getByText("You found it!")).toBeTruthy();
    expect(screen.getByText("John · 100 pts")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(localStorage.getItem(savedRoundKey("john"))).toBeNull();
    await user.type(screen.getByLabelText("Email address"), "other@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Other · 50 pts")).toBeTruthy();
    expect(await screen.findByRole("combobox")).toBeTruthy();
    expect(screen.queryByText("You found it!")).toBeNull();
    expect(screen.queryByText("Portugal")).toBeNull();
  });
});

describe("Restoring a saved round", () => {
  const snapshot = {
    gameId: "saved-round",
    status: "IN_PROGRESS",
    maxGuesses: 6,
    guessesUsed: 2,
    guesses: [
      { countryId: "ES", guessName: "Spain", range: "500–1,500 km" },
      { countryId: "FR", guessName: "France", range: "< 500 km" },
    ],
  };

  it("starts a fresh round after signing out and signing back in, keeping earned points", async () => {
    keepLogin();
    localStorage.setItem(savedRoundKey("john"), "saved-round");
    window.history.replaceState(null, "", "/game");
    const fetcher = vi.fn((url: string) => {
      if (url.endsWith("games/saved-round")) return Promise.resolve(Response.json(snapshot));
      if (url.endsWith("users/me")) return Promise.resolve(Response.json({ totalPoints: 25 }));
      if (url.endsWith("auth/login")) return Promise.resolve(Response.json(signedInPlayer("John", 25)));
      if (url.endsWith("/api/games")) return Promise.resolve(Response.json({ gameId: "fresh-round", maxGuesses: 6 }));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    await screen.findByText("4 guesses left");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(localStorage.getItem("token_data")).toBeNull();
    expect(localStorage.getItem(savedRoundKey("john"))).toBeNull();
    expect(screen.queryByText("Spain")).toBeNull();
    await user.type(screen.getByLabelText("Email address"), "john@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("6 guesses left")).toBeTruthy();
    expect(screen.queryByText("Spain")).toBeNull();
    expect(screen.getByText("John · 25 pts")).toBeTruthy();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("games/saved-round"))).toHaveLength(1);
    expect(localStorage.getItem(savedRoundKey("john"))).toBe("fresh-round");
  });

  it.each(["IN_PROGRESS", "WON"])("reloads a %s round and uses the server's points without awarding them again", async (status) => {
    keepLogin();
    sessionStorage.setItem(savedRoundKey("john"), "saved-round");
    window.history.replaceState(null, "", "/game");
    const fetcher = vi.fn((url: string) => {
      if (url.endsWith("games/saved-round")) return Promise.resolve(Response.json({
        ...snapshot, status,
        ...(status === "WON" ? { pointsEarned: 90, targetCountry: "France" } : {}),
      }));
      if (url.endsWith("users/me")) return Promise.resolve(Response.json({ totalPoints: 175 }));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    expect(await screen.findByText("4 guesses left")).toBeTruthy();
    expect(screen.getByText("John · 175 pts")).toBeTruthy();
    const history = screen.getByRole("region", { name: "Your guesses" });
    expect(within(history).getByText("Spain")).toBeTruthy();
    expect(within(history).getByText("France")).toBeTruthy();
    expect(Boolean(screen.queryByText("You found it!"))).toBe(status === "WON");
    expect(Boolean(screen.queryByRole("combobox"))).toBe(status === "IN_PROGRESS");
    expect(screen.queryByRole("button", { name: "Start round" })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("preserves the saved round after a network failure and allows retrying", async () => {
    keepLogin();
    sessionStorage.setItem(savedRoundKey("john"), "saved-round");
    window.history.replaceState(null, "", "/game");
    let unavailable = true;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("users/me")) return Promise.resolve(Response.json({ totalPoints: 20 }));
      if (url.endsWith("games/saved-round")) {
        return unavailable ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve(Response.json(snapshot));
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
    render(<App />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not reload");
    expect(sessionStorage.getItem(savedRoundKey("john"))).toBe("saved-round");
    expect(screen.queryByRole("button", { name: "Start round" })).toBeNull();
    unavailable = false;
    await userEvent.click(screen.getByRole("button", { name: "Try loading round again" }));
    expect(await screen.findByText("4 guesses left")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("allows a new round when the server says the saved round no longer exists", async () => {
    keepLogin();
    sessionStorage.setItem(savedRoundKey("john"), "deleted-round");
    window.history.replaceState(null, "", "/game");
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(
      url.endsWith("users/me") ? Response.json({ totalPoints: 20 }) : Response.json({ error: "Game not found" }, { status: 404 }),
    )));
    render(<App />);
    expect(await screen.findByRole("button", { name: "Try starting round again" })).toBeTruthy();
    expect(sessionStorage.getItem(savedRoundKey("john"))).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("no longer available");
  });

  it("does not load a different account's saved round", async () => {
    const other = signedInPlayer("Other", 25);
    localStorage.setItem("token_data", other.accessToken);
    localStorage.setItem("user_data", JSON.stringify(other.user));
    sessionStorage.setItem(savedRoundKey("john"), "johns-round");
    window.history.replaceState(null, "", "/game");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ gameId: "other-game", maxGuesses: 6 }));
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    expect(screen.getByText("Other · 25 pts")).toBeTruthy();
    expect(await screen.findByRole("combobox")).toBeTruthy();
    expect(fetcher.mock.calls.every(([url]) => url.endsWith("/api/games"))).toBe(true);
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
