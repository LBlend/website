import { SIMKL_CLIENT_ID, SIMKL_URL, SIMKL_USER_ID } from "astro:env/server";
import { defineSource, fetchJson, HOUR } from "./source";

interface SimklPayload {
  movies: { total_mins: number; completed: { count: number } };
  tv: { total_mins: number; completed: { count: number } };
}

export default defineSource({
  name: "simkl",
  intervalMs: HOUR,
  isConfigured: () => Boolean(SIMKL_CLIENT_ID && SIMKL_USER_ID),
  fetch: (signal) =>
    fetchJson<SimklPayload>(
      `${SIMKL_URL}users/${SIMKL_USER_ID}/stats`,
      { headers: { "Content-Type": "application/json", "simkl-api-key": SIMKL_CLIENT_ID ?? "" } },
      signal,
    ),
  derive: (payload) => ({
    movies: { hoursWatched: payload.movies.total_mins / 60, completedCount: payload.movies.completed.count },
    shows: { hoursWatched: payload.tv.total_mins / 60, completedCount: payload.tv.completed.count },
  }),
  fallback: {
    movies: { hoursWatched: 0, completedCount: 0 },
    shows: { hoursWatched: 0, completedCount: 0 },
  },
});
