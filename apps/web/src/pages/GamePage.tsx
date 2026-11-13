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
import { api, readPlayer } from "../api";
import { CountrySearch, type CountryOption } from "../components/CountrySearch";
import { GuessHistory, RoundResult } from "../components/RoundUI";
import { guessResponseSchema, startRoundSchema, type Round } from "../round";

function useGameState(initialPoints?: number) {
  const [round, setRound] = useState<Round | null>(null);
  const [points, setPoints] = useState(initialPoints);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestPending = useRef(false);

  function beginRequest() {
    if (requestPending.current) return false;
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
    setRound,
    points,
    setPoints,
    busy,
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
}: {
  children: ReactNode;
  initialPoints?: number;
}) {
  const state = useGameState(initialPoints);
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
    <GameSession key={sessionKey} initialPoints={player?.totalPoints}>
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
          {player && !round && (
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
