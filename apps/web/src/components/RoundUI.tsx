import type { Ref } from "react";
import type { Round } from "../round";
import { guessRank, guessesLeft } from "../round";
export function GuessHistory({ round }: { round: Round | null }) {
  const sorted = [...(round?.guesses ?? [])].sort(
    (a, b) => guessRank(a) - guessRank(b),
  );
  return (
    <section className="sample-guesses" aria-labelledby="guesses-title">
      <div className="sample-heading">
        <h2 id="guesses-title">Your guesses</h2>
        {round && (
          <span aria-live="polite">{guessesLeft(round)} guesses left</span>
        )}
      </div>
      {sorted.length ? (
        <ol className="guess-history">
          {sorted.map((guess) => (
            <li key={guess.countryId}>
              <span>{guess.name}</span>
              <strong>{guess.correct ? "Correct country" : guess.range}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <div className="guesses-empty">
          <small>Your countries and distance clues will appear here.</small>
        </div>
      )}
    </section>
  );
}
export function RoundResult({
  round,
  onPlayAgain,
  busy = false,
  playAgainRef,
}: {
  round: Round;
  onPlayAgain: () => void;
  busy?: boolean;
  playAgainRef?: Ref<HTMLButtonElement>;
}) {
  if (round.status === "active") return null;
  const won = round.status === "won";
  return (
    <section
      className={`round-result ${won ? "round-won" : ""}`}
      aria-labelledby="result-title"
      role="status"
    >
      <p className="preview-kicker">
        {won ? "COUNTRY FOUND" : "ROUND COMPLETE"}
      </p>
      <h2 id="result-title">{won ? "You found it!" : "Out of guesses"}</h2>
      {round.answer && (
        <p>
          The mystery country was <strong>{round.answer}</strong>.
        </p>
      )}
      <div className="round-stats">
        <p>
          <strong>{round.guessesUsed}</strong> guesses used
        </p>
        <p>
          <strong>{round.pointsEarned ?? 0}</strong> points earned
        </p>
      </div>
      <button
        ref={playAgainRef}
        type="button"
        onClick={onPlayAgain}
        disabled={busy}
      >
        {busy ? "Starting round…" : "Play again"}
      </button>
    </section>
  );
}
