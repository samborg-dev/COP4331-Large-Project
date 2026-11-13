import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import type { SubmitGuessInput } from "@cop4331/shared";
import { api, ApiError, readPlayer, savedRoundKey } from "../api";
import { CountrySearch, type CountryOption } from "../components/CountrySearch";
import { GuessHistory, RoundResult } from "../components/RoundUI";
import { guessResponseSchema, savedRoundSchema, startRoundSchema, type Round } from "../round";

function useGameState(initialPoints?: number, playerId?: string) {
  const storageKey = playerId ? savedRoundKey(playerId) : null;
  const [savedGameId] = useState(() => storageKey
    ? localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey)
    : null);
  const [round, setRound] = useState<Round | null>(null);
  const [points, setPoints] = useState(initialPoints);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(Boolean(savedGameId));
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const requestPending = useRef(false);

  useEffect(() => {
    if (!savedGameId) return;
    const controller = new AbortController();
    async function restoreRound() {
      try {
        const [game, profile] = await Promise.allSettled([
          api<unknown>(`games/${encodeURIComponent(savedGameId!)}`, undefined, true, controller.signal),
          api<{ totalPoints?: unknown }>("users/me", undefined, true, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        if (game.status === "rejected") throw game.reason;
        const restored = savedRoundSchema.parse(game.value);
        if (restored.gameId !== savedGameId) throw new Error("The server returned a different round.");
        if (storageKey) {
          localStorage.setItem(storageKey, restored.gameId);
          sessionStorage.removeItem(storageKey);
        }
        setRound(restored);
        // Use the saved server total, rather than adding the same win again.
        const total = profile.status === "fulfilled" ? profile.value?.totalPoints : undefined;
        setPoints(typeof total === "number" && Number.isFinite(total) ? total : undefined);
        setRestoreFailed(false);
        setError("");
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && [403, 404].includes(cause.status)) {
          if (storageKey) {
            localStorage.removeItem(storageKey);
            sessionStorage.removeItem(storageKey);
          }
          setError("Your previous round is no longer available. You can start a new round.");
          setRestoreFailed(false);
        } else {
          setError("Could not reload your saved round. Try again to keep your progress.");
          setRestoreFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setRestoring(false);
      }
    }
    void restoreRound();
    return () => controller.abort();
  }, [savedGameId, storageKey, restoreAttempt]);

  function saveRound(nextRound: Round) {
    if (storageKey) {
      localStorage.setItem(storageKey, nextRound.gameId);
      sessionStorage.removeItem(storageKey);
    }
    setRound(nextRound);
  }

  function retryRestore() {
    setRestoring(true);
    setRestoreFailed(false);
    setError("");
    setRestoreAttempt((attempt) => attempt + 1);
  }

  function beginRequest() {
    if (requestPending.current || restoring) return false;
    requestPending.current = true;
    setBusy(true);
    setError("");
    return true;
  }

  function finishRequest() {
    requestPending.current = false;
    setBusy(false);
  }

  return {
    round,
    setRound: saveRound,
    points,
    setPoints,
    busy: busy || restoring,
    restoring,
    restoreFailed,
    retryRestore,
    error,
    setError,
    beginRequest,
    finishRequest,
  };
}

const GameSessionContext = createContext<ReturnType<typeof useGameState> | null>(
  null,
);

function GameSession({
  children,
  initialPoints,
  playerId,
}: {
  children: ReactNode;
  initialPoints?: number;
  playerId?: string;
}) {
  const state = useGameState(initialPoints, playerId);
  return (
    <GameSessionContext.Provider value={state}>
      {children}
    </GameSessionContext.Provider>
  );
}

export function GameSessionProvider({ children }: { children: ReactNode }) {
  // Navigation rechecks the session; changing accounts resets the saved round.
  useLocation();
  const player = readPlayer();
  const sessionKey = player ? localStorage.getItem("token_data") : null;
  return (
    <GameSession key={sessionKey} initialPoints={player?.totalPoints} playerId={player?.id}>
      {children}
    </GameSession>
  );
}

export function GamePage({
  player,
  onSignOut,
}: {
  player?: { name: string; totalPoints?: number };
  onSignOut?: () => void;
}) {
  const session = useContext(GameSessionContext);
  if (!session) throw new Error("GamePage requires GameSessionProvider");
  const { setRound, setPoints, busy, setError, beginRequest, finishRequest } =
    session;
  const round = player ? session.round : null;
  const points = player ? session.points : undefined;
  const error = player ? session.error : "";
  const helpDialog = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const playAgainButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (busy || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (document.activeElement !== document.body) return;
    (
      searchInput.current ??
      playAgainButton.current ??
      startButton.current
    )?.focus();
  }, [busy, round, error]);

  async function startRound() {
    if (!beginRequest()) return;
    restoreFocus.current = true;
    try {
      const { gameId, maxGuesses } = startRoundSchema.parse(
        await api<unknown>("games", {}, true),
      );
      setRound({
        gameId,
        maxGuesses,
        status: "active",
        guessesUsed: 0,
        guesses: [],
      });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name !== "ZodError"
          ? cause.message
          : "The server returned an unexpected round.",
      );
    } finally {
      finishRequest();
    }
  }

  async function submitGuess(country: CountryOption) {
    if (!round || round.status !== "active" || busy) return;
    if (round.guesses.some((guess) => guess.countryId === country.id)) {
      setError("You already guessed that country.");
      return;
    }
    if (!beginRequest()) return;
    restoreFocus.current = true;
    try {
      const guess = guessResponseSchema.parse(
        await api<unknown>(
          "games/" + encodeURIComponent(round.gameId) + "/guesses",
          { countryId: country.id } satisfies SubmitGuessInput,
          true,
        ),
      );
      const status = guess.solved
        ? "won"
        : guess.guessesUsed >= round.maxGuesses
          ? "lost"
          : "active";
      setRound({
        ...round,
        status,
        guessesUsed: guess.guessesUsed,
        guesses: [
          ...round.guesses,
          {
            countryId: country.id,
            name: guess.country,
            range: guess.range,
            correct: guess.solved,
          },
        ],
        pointsEarned: guess.pointsEarned,
        answer: guess.solved ? guess.country : undefined,
      });
      if (guess.solved && guess.pointsEarned !== undefined) {
        const earned = guess.pointsEarned;
        setPoints((total) =>
          total === undefined ? undefined : total + earned,
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name !== "ZodError"
          ? cause.message
          : "The server returned an unexpected guess result.",
      );
    } finally {
      finishRequest();
    }
  }

  return (
    <main className="preview-page">
      <header className="preview-header">
        <Link className="brand" to={player ? "/game" : "/guest"}>
          CountryGuesser
        </Link>
        <div className="guest-account">
          <Link to="/leaderboard">Leaderboard</Link>
          <span>
            {player?.name ?? "Guest"}
            {points !== undefined && " · " + points.toLocaleString() + " pts"}
          </span>
          {player ? (
            <button className="signout-link" type="button" onClick={onSignOut}>
              Sign out
            </button>
          ) : (
            <Link to="/">Sign in</Link>
          )}
          <button
            className="help-trigger"
            type="button"
            aria-label="How to play"
            title="How to play"
            onClick={() => helpDialog.current?.showModal()}
          >
            ?
          </button>
        </div>
      </header>

      <section className="preview-game" aria-label="Country guessing game">
        <div className="game-search-area">
          <p className="preview-kicker">FIND THE MYSTERY COUNTRY</p>
          <p className="game-instructions">
            Each guess brings you closer. Follow the distance clues.
          </p>
          {!player && (
            <p className="preview-caption">
              <Link to="/">Sign in</Link> to start a round and save your
              score.
            </p>
          )}
          {player && session.restoring && <p role="status">Loading your round…</p>}
          {player && session.restoreFailed && (
            <button type="button" onClick={session.retryRestore}>Try loading round again</button>
          )}
          {player && !round && !session.restoring && !session.restoreFailed && (
            <button
              ref={startButton}
              type="button"
              onClick={startRound}
              disabled={busy}
            >
              {busy ? "Starting round…" : "Start round"}
            </button>
          )}
          {round?.status === "active" && (
            <CountrySearch
              key={round.gameId + ":" + round.guessesUsed}
              disabled={busy}
              inputRef={searchInput}
              onSelect={submitGuess}
            />
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="map-space">
          {round && (
            <RoundResult
              round={round}
              onPlayAgain={startRound}
              busy={busy}
              playAgainRef={playAgainButton}
            />
          )}
        </div>
        <GuessHistory round={round} />
      </section>

      <dialog
        className="help-dialog"
        ref={helpDialog}
        aria-labelledby="help-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) helpDialog.current?.close();
        }}
      >
        <div className="help-content">
          <button
            type="button"
            className="help-close"
            aria-label="Close help"
            onClick={() => helpDialog.current?.close()}
          >
            ×
          </button>
          <p className="preview-kicker">COUNTRYGUESSER</p>
          <h2 id="help-title">How to play</h2>
          <p>Each guess brings you closer. Follow the distance clues.</p>
        </div>
      </dialog>
    </main>
  );
}
