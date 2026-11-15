import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./env", () => ({ env: { VITE_API_URL: "http://localhost:5000" } }));
const dialogMethods = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype);
afterEach(() => {
  cleanup(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  for (const name of ["showModal", "close"]) {
    if (dialogMethods[name]) Object.defineProperty(HTMLDialogElement.prototype, name, dialogMethods[name]);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  window.history.replaceState(null, "", "/");
});

it("only gives up after confirmation, reveals the answer, and keeps the guesses counter", async () => {
  // jsdom does not implement native dialog methods; browser checks cover focus/Escape.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
  });
  localStorage.setItem("token_data", `e30.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.signature`);
  localStorage.setItem("user_data", JSON.stringify({ id: "player", firstName: "John", totalPoints: 90 }));
  const fetcher = vi.fn((url: string) => {
    if (url.endsWith("/api/games")) return Promise.resolve(Response.json({ gameId: "round-1", maxGuesses: 10 }));
    if (url.endsWith("/give-up")) return Promise.resolve(Response.json({ gameId: "round-1" }));
    if (url.endsWith("/api/games/round-1")) return Promise.resolve(Response.json({
      gameId: "round-1", status: "lost", maxGuesses: 10, guessesUsed: 0,
      guesses: [], pointsEarned: 0, answer: "Japan", surrendered: true,
    }));
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  window.history.replaceState(null, "", "/game");
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Give up" }));
  await user.click(screen.getByRole("button", { name: "Keep guessing" }));
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/give-up"))).toBe(false);
  await user.click(screen.getByRole("button", { name: "Give up" }));
  await user.click(screen.getByRole("button", { name: "Give up round" }));
  expect(await screen.findByText("Japan")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Round ended" })).toBeTruthy();
  expect(screen.getByText("10 guesses left")).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/give-up"))).toHaveLength(1);
});
