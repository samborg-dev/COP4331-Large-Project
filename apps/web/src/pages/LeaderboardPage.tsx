import { useEffect, useRef, useState, type Ref } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { api, readPlayer } from "../api";

const leaderboardSchema = z.object({
  entries: z.array(
    z.object({
      rank: z.number().int().positive(),
      userId: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      totalPoints: z.number(),
    }),
  ),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

type Leaderboard = z.infer<typeof leaderboardSchema>;

export function Rankings({
  data,
  currentUserId,
  onPageChange,
  pageLabelRef,
}: {
  data: Leaderboard;
  currentUserId?: string;
  onPageChange: (page: number) => void;
  pageLabelRef?: Ref<HTMLSpanElement>;
}) {
  const { entries, page, limit, total } = data;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <>
      {entries.length ? (
        <div className="ranking-table-wrap">
          <table className="ranking-table">
            <caption className="sr-only">
              Players ranked by total points
            </caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.userId}
                  className={
                    entry.userId === currentUserId
                      ? "current-player"
                      : undefined
                  }
                >
                  <td>{entry.rank}</td>
                  <th scope="row">
                    {entry.firstName} {entry.lastName}
                    {entry.userId === currentUserId && <small>You</small>}
                  </th>
                  <td>{entry.totalPoints.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ranking-empty">No rankings to show yet.</p>
      )}
      <nav className="pagination" aria-label="Leaderboard pages">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span ref={pageLabelRef} tabIndex={-1} aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </nav>
    </>
  );
}

export function LeaderboardPage() {
  const player = readPlayer();
  const signedIn = player !== null;
  const [request, setRequest] = useState({ page: 1 });
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState("");
  const restoreFocus = useRef(false);
  const pageLabel = useRef<HTMLSpanElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if ((!data && !error) || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (document.activeElement === document.body) {
      (pageLabel.current ?? retryButton.current)?.focus();
    }
  }, [data, error]);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    async function loadPage() {
      try {
        const response = await api<unknown>(
          "leaderboard?" +
            new URLSearchParams({ page: String(request.page), limit: "20" }),
          undefined,
          true,
          controller.signal,
        );
        if (!controller.signal.aborted)
          setData(leaderboardSchema.parse(response));
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error && cause.name !== "ZodError"
              ? cause.message
              : "The server returned an unexpected leaderboard.",
          );
        }
      }
    }
    void loadPage();
    return () => controller.abort();
  }, [request, signedIn]);

  function loadPage(page: number) {
    restoreFocus.current = true;
    setData(null);
    setError("");
    setRequest({ page });
  }

  return (
    <main className="preview-page leaderboard-page">
      <header className="preview-header">
        <Link className="brand" to={player ? "/game" : "/guest"}>
          CountryGuesser
        </Link>
        <Link to={player ? "/game" : "/guest"}>Back to game</Link>
      </header>
      <section className="leaderboard-card">
        <p className="preview-kicker">THE WORLD'S TOP EXPLORERS</p>
        <h1>Leaderboard</h1>
        {!signedIn ? (
          <p className="ranking-empty">
            <Link to="/">Sign in</Link> to view the leaderboard.
          </p>
        ) : error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <button
              ref={retryButton}
              type="button"
              onClick={() => loadPage(request.page)}
            >
              Try again
            </button>
          </>
        ) : data ? (
          <Rankings
            data={data}
            currentUserId={player.id}
            onPageChange={loadPage}
            pageLabelRef={pageLabel}
          />
        ) : (
          <p className="ranking-empty" role="status">
            Loading leaderboard…
          </p>
        )}
      </section>
    </main>
  );
}
