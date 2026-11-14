import { useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import type {
  AuthLoginResponse,
  LoginInput,
  RegisterInput,
} from "@cop4331/shared";
import { api, ApiError, clearSession, readPlayer, validSession } from "../api";
import { GamePage } from "./GamePage";
const screens: Record<string, [string, string, string]> = {
  "/": [
    "Sign in to play",
    "Welcome back. A world of possibilities awaits.",
    "Sign in",
  ],
  "/register": [
    "Create your account",
    "Make your first guess. Find your place on the leaderboard.",
    "Create account",
  ],
  "/check-inbox": [
    "Check your inbox",
    "Open your verification email to finish creating your account. Need another link? Enter your email below.",
    "Resend verification email",
  ],
  "/verify-email": [
    "Verify your email",
    "Confirm your email address to unlock your account.",
    "Verify email",
  ],
  "/forgot-password": [
    "Forgot your password?",
    "Enter your email and we will send a reset link.",
    "Send reset link",
  ],
  "/reset-password": [
    "Choose a new password",
    "A fresh start for your next adventure.",
    "Update password",
  ],
};
export function ProtectedPage() {
  const navigate = useNavigate();
  const player = readPlayer();
  if (!player) return <Navigate to="/" replace />;
  return (
    <GamePage
      player={player}
      onSignOut={() => {
        clearSession(true);
        navigate("/", { replace: true });
      }}
    />
  );
}
export function AuthPage() {
  const location = useLocation();
  const pathname = location.pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const path = pathname === "/login" ? "/" : pathname;
  return <AuthForm key={location.key} path={path} />;
}
function AuthForm({ path }: { path: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [resend, setResend] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [title, subtitle, action] = screens[path];
  const login = path === "/";
  const register = path === "/register";
  const reset = path === "/reset-password";
  const verify = path === "/verify-email";
  const token = params.get("token");
  const missingToken = (reset || verify) && !token;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    setError("");
    setNotice("");
    if ((register || reset) && password !== data.get("confirm")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (login) {
        const result = await api<AuthLoginResponse>("auth/login", {
          email: email.trim(),
          password,
        } satisfies LoginInput);
        if (!result?.user || !validSession(result.accessToken))
          throw new Error(
            "The server returned an incomplete or expired login session.",
          );
        localStorage.setItem("token_data", result.accessToken);
        localStorage.setItem("user_data", JSON.stringify(result.user));
        navigate("/game", { replace: true });
      } else if (register) {
        await api("auth/register", {
          firstName: String(data.get("firstName")).trim(),
          lastName: String(data.get("lastName")).trim(),
          email: email.trim(),
          password,
        } satisfies RegisterInput);
        navigate("/check-inbox");
      } else if (verify && token) {
        await api("auth/verify-email", { token });
        setNotice("Your email is verified. You can now sign in.");
        setDone(true);
      } else if (reset && token) {
        await api("auth/reset-password", { token, password });
        setNotice("Your password has been updated. You can now sign in.");
        setDone(true);
      } else {
        await api(
          path === "/check-inbox"
            ? "auth/resend-verification"
            : "auth/forgot-password",
          { email: email.trim() },
        );
        setNotice(
          path === "/check-inbox"
            ? "If your account needs verification, a new link is on its way."
            : "If an account exists for that email, a reset link is on its way.",
        );
        if (path === "/forgot-password") setDone(true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again.",
      );
      if (login && cause instanceof ApiError && cause.status === 403)
        setResend(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <header className="auth-header">
        <Link className="brand" to="/guest">
          CountryGuesser
        </Link>
      </header>
      <section className="form-side">
        <div className="auth-card">
          <h2>{title}</h2>
          <p className="subtitle">{subtitle}</p>
          {login && (
            <nav className="auth-tabs" aria-label="Account">
              <Link to="/" aria-current="page">
                Sign in
              </Link>
              <Link to="/register">Create account</Link>
            </nav>
          )}
          {params.get("session") === "expired" && (
            <p role="status" className="notice">
              Your session expired. Please sign in again.
            </p>
          )}
          {missingToken && (
            <p role="alert" className="error">
              This link is missing its token. Request a new email using the link
              below.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          {!done && !missingToken && (
            <form onSubmit={submit} aria-busy={busy}>
              <fieldset disabled={busy}>
                {register && (
                  <div className="name-row">
                    <label>
                      First name
                      <input
                        name="firstName"
                        autoComplete="given-name"
                        required
                        maxLength={100}
                        pattern=".*\S.*"
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        name="lastName"
                        autoComplete="family-name"
                        required
                        maxLength={100}
                        pattern=".*\S.*"
                      />
                    </label>
                  </div>
                )}
                {!verify && !reset && (
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                )}
                {(login || register || reset) && (
                  <label className="password-field">
                    Password
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={login ? 1 : 8}
                      autoComplete={login ? "current-password" : "new-password"}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      aria-describedby={
                        !login && passwordFocused ? "password-help" : undefined
                      }
                    />
                    {!login && (
                      <small
                        id="password-help"
                        className="password-hint"
                        style={{
                          visibility: passwordFocused ? "visible" : "hidden",
                        }}
                      >
                        Use at least 8 characters.
                      </small>
                    )}
                  </label>
                )}
                {(register || reset) && (
                  <label>
                    Confirm password
                    <input
                      name="confirm"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </label>
                )}
                {login && (
                  <Link className="forgot-link" to="/forgot-password">
                    Forgot password?
                  </Link>
                )}
                <button type="submit">{busy ? "Please wait…" : action}</button>
              </fieldset>
            </form>
          )}

          {resend && (
            <p>
              <Link to="/check-inbox">Resend verification email</Link>
            </p>
          )}
          {verify && !done && (
            <p>
              <Link to="/check-inbox">Request a new verification link</Link>
            </p>
          )}
          {reset && !done && (
            <p>
              <Link to="/forgot-password">Request a new reset link</Link>
            </p>
          )}
          {!login && (
            <p className="back-link">
              <Link to="/">← Back to sign in</Link>
            </p>
          )}
        </div>
        {(login || register) && (
          <Link className="guest-card" to="/guest">
            Continue as guest
          </Link>
        )}
      </section>
    </main>
  );
}
