import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { SubmitGuessInput } from "@cop4331/shared";
import { api, ApiError } from "../api";
import { CountrySearch, type CountryOption } from "../components/CountrySearch";
import { GuessHistory, RoundResult } from "../components/RoundUI";
import {
  guessResponseSchema,
  resumeRoundSchema,
  startRoundSchema,
  type Round,
} from "../round";

const CURRENT_GAME_KEY = "current_game_id";

export function GamePage({
  player,
  onSignOut,
}: {
  player?: { name: string; totalPoints?: number };
  onSignOut?: () => void;
}) {
  const helpDialog = useRef<HTMLDialogElement>(null);
  const requestPending = useRef(false);
  const restoreFocus = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const playAgainButton = useRef<HTMLButtonElement>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [points, setPoints] = useState(player?.totalPoints);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const gameId = localStorage.getItem(CURRENT_GAME_KEY);
    if (!player || !gameId || requestPending.current) return;

    requestPending.current = true;
    setBusy(true);
    void api<unknown>(
      "games/" + encodeURIComponent(gameId),
      undefined,
      true,
    )
      .then((data) => {
        const restored = resumeRoundSchema.parse(data);
        setRound({
          gameId: restored.gameId,
          status: restored.status,
          maxGuesses: restored.maxGuesses,
          guessesUsed: restored.guessesUsed,
          guesses: restored.guesses.map((guess) => {
            return {
              countryId: guess.countryId,
              name: guess.country,
              range: guess.range,
              correct: guess.range === "Correct",
            };
          }),
          pointsEarned: restored.pointsEarned,
          answer: restored.answer,
        });
      })
      .catch((cause) => {
        if (cause instanceof ApiError && (cause.status === 403 || cause.status === 404)) {
          localStorage.removeItem(CURRENT_GAME_KEY);
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "The server returned an unexpected round.",
        );
      })
      .finally(() => {
        requestPending.current = false;
        setBusy(false);
      });
  }, [player]);

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
    if (requestPending.current) return;
    requestPending.current = true;
    restoreFocus.current = true;
    setBusy(true);
    setError("");
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
      localStorage.setItem(CURRENT_GAME_KEY, gameId);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name !== "ZodError"
          ? cause.message
          : "The server returned an unexpected round.",
      );
    } finally {
      requestPending.current = false;
      setBusy(false);
    }
  }

  async function submitGuess(country: CountryOption) {
    if (!round || round.status !== "active" || requestPending.current) return;
    if (round.guesses.some((guess) => guess.countryId === country.id)) {
      setError("You already guessed that country.");
      return;
    }
    requestPending.current = true;
    restoreFocus.current = true;
    setBusy(true);
    setError("");
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
      requestPending.current = false;
      setBusy(false);
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
