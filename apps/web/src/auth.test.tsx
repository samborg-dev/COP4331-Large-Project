import App from "./App";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthPage, ProtectedPage } from "./pages/AuthPage";
import { GameSessionProvider } from "./pages/GamePage";
import { api, ApiError } from "./api";
vi.mock("./env", () => ({ env: { VITE_API_URL: "http://localhost:5000" } }));
function show(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GameSessionProvider>
        <Routes>
          <Route path="/game" element={<ProtectedPage />} />
          <Route path="*" element={<AuthPage />} />
        </Routes>
      </GameSessionProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Account screens", () => {
  it("sends credentials and keeps a login error visible", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Invalid email or password" }), {
          status: 401,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    show();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email address"), "john@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Invalid email or password",
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "http://localhost:5000/api/auth/login",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      email: "john@example.com",
      password: "wrong-password",
    });
  });
  it("rejects mismatched passwords without making a request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    show("/register");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("First name"), "John");
    await user.type(screen.getByLabelText("Last name"), "Sarkis");
    await user.type(screen.getByLabelText("Email address"), "john@example.com");
    await user.type(screen.getByLabelText(/^Password/), "password-one");
    await user.type(screen.getByLabelText("Confirm password"), "password-two");
    await user.click(screen.getByRole("button", { name: /Create account/ }));
    expect(screen.getByRole("alert").textContent).toContain("do not match");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("handles missing email-link tokens", () => {
    show("/reset-password");
    expect(screen.getByRole("alert").textContent).toContain(
      "missing its token",
    );
    expect(
      screen.queryByRole("button", { name: /Update password/ }),
    ).toBeNull();
  });
  it("confirms verification explicitly and submits the URL token", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    show("/verify-email?token=test-token");
    expect(fetcher).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Verify email/ }));
    expect((await screen.findByRole("status")).textContent).toContain(
      "verified",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      token: "test-token",
    });
  });
  it("redirects a logged-out visitor away from the game", () => {
    show("/game");
    expect(
      screen.getByRole("heading", { name: "Sign in to play" }),
    ).toBeTruthy();
  });
  it("rejects an expired session", () => {
    localStorage.setItem(
      "token_data",
      `e30.${btoa(JSON.stringify({ exp: 1 }))}.signature`,
    );
    show("/game");
    expect(
      screen.getByRole("heading", { name: "Sign in to play" }),
    ).toBeTruthy();
  });
  it("reports an unavailable server without pretending success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    show("/forgot-password");
    await userEvent.type(
      screen.getByLabelText("Email address"),
      "john@example.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Send reset link/ }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Cannot reach",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
describe("API client", () => {
  it("adds a Bearer token only to protected requests", async () => {
    localStorage.setItem("token_data", "test-token");
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetcher);
    await api("users/me", undefined, true);
    await api("auth/login", { email: "test@example.com", password: "test" });
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer test-token",
    );
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });
  it("rejects malformed successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>wrong server</html>")),
    );
    await expect(
      api("auth/verify-email", { token: "test" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

it('shows the shared game screen after login and clears the session on sign out', async () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  localStorage.setItem('token_data', `e30.${payload}.signature`);
  localStorage.setItem('user_data', JSON.stringify({ firstName: 'John' }));
  show('/game');
  expect(screen.getByRole('region', { name: 'Country guessing game' })).toBeTruthy();
  expect(screen.getByText('John')).toBeTruthy();
  expect(screen.queryByText('Guest')).toBeNull();
  expect(screen.queryByText('Your next discovery awaits.')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(localStorage.getItem('token_data')).toBeNull();
  expect(localStorage.getItem('user_data')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Sign in to play' })).toBeTruthy();
});

it('keeps a valid session usable if stored player data is malformed', () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  localStorage.setItem('token_data', `e30.${payload}.signature`);
  localStorage.setItem('user_data', '{broken');
  show('/game');
  expect(screen.getByText('Player')).toBeTruthy();
  expect(screen.getByRole('button', {name:'Sign out'})).toBeTruthy();
});


it('opens sign-in at home and lets a guest visit the game and return', async () => {
  window.history.replaceState(null, '', '/');
  render(<App />);
  expect(screen.getByRole('heading', {name:'Sign in to play'})).toBeTruthy();
  await userEvent.click(screen.getByRole('link', {name:'Continue as guest'}));
  expect(window.location.pathname).toBe('/guest');
  expect(screen.getByRole('region', {name:'Country guessing game'})).toBeTruthy();
  expect(screen.getByText('Guest')).toBeTruthy();
  await userEvent.click(within(screen.getByRole('banner')).getByRole('link', {name:'Sign in'}));
  expect(window.location.pathname).toBe('/');
  expect(screen.getByRole('heading', {name:'Sign in to play'})).toBeTruthy();
});

it.each(['/login', '/LOGIN/'])('preserves the expired session message at %s', (path) => {
  window.history.replaceState(null, '', path + '?session=expired');
  render(<App />);
  expect(screen.getByRole('heading', {name:'Sign in to play'})).toBeTruthy();
  expect(screen.getByText('Your session expired. Please sign in again.')).toBeTruthy();
});
