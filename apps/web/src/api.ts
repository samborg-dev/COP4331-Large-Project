import { env } from "./env";
import { jwtDecode } from "jwt-decode";

export function validSession(token: string | null) {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token || "");
    return typeof exp === "number" && exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function readPlayer() {
  if (!validSession(localStorage.getItem("token_data"))) return null;
  const fallback = { name: "Player", id: undefined, totalPoints: undefined };
  try {
    const user = JSON.parse(localStorage.getItem("user_data") || "null");
    return {
      name:
        typeof user?.firstName === "string"
          ? user.firstName.trim() || "Player"
          : "Player",
      id: typeof user?.id === "string" ? user.id : undefined,
      totalPoints:
        typeof user?.totalPoints === "number" ? user.totalPoints : undefined,
    };
  } catch {
    return fallback;
  }
}
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export const savedRoundKey = (userId: string) => `countryguesser.round.${userId}`;

export function clearSession() {
  // Keep the per-account round ID so signing back in can reload it from the API.
  localStorage.removeItem("token_data");
  localStorage.removeItem("user_data");
}
export async function api<T>(
  path: string,
  body?: unknown,
  authenticated = false,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = localStorage.getItem("token_data");
  if (authenticated && token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(
      `${env.VITE_API_URL.replace(/\/$/, "")}/api/${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers,
        signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError("Cannot reach the server. Please try again shortly.", 0);
  }
  if (authenticated && response.status === 401 && !signal?.aborted) {
    clearSession();
    window.location.replace("/?session=expired");
    throw new ApiError("Your session expired.", 401);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error)
    throw new ApiError(
      data?.error ||
        (response.status === 404
          ? "This service is not available yet. Please try again later."
          : "The request failed. Please try again."),
      response.status,
    );
  if (data === null && response.status !== 204)
    throw new ApiError(
      "The server returned an unexpected response.",
      response.status,
    );
  return data as T;
}
