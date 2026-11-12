import { DAWARICH_API_KEY, DAWARICH_URL } from "astro:env/server";
import { defineSource, fetchJson, HOUR } from "./source";

interface DawarichPayload {
  yearlyStats: { year: number; totalDistanceKm: number }[];
}

export default defineSource({
  name: "dawarich",
  intervalMs: HOUR,
  isConfigured: () => Boolean(DAWARICH_API_KEY),
  fetch: (signal) =>
    fetchJson<DawarichPayload>(
      `${DAWARICH_URL}api/v1/stats?` + new URLSearchParams({ api_key: DAWARICH_API_KEY ?? "" }),
      {},
      signal,
    ),
  derive: (payload) => {
    if (!Array.isArray(payload.yearlyStats)) throw new Error("Unexpected Dawarich response");
    const currentYear = Number(new Date().toLocaleString("en", { timeZone: "Europe/Oslo", year: "numeric" }));
    const thisYear = payload.yearlyStats.find((stats) => stats.year === currentYear);
    return { distanceThisYearKm: thisYear?.totalDistanceKm ?? 0 };
  },
  fallback: { distanceThisYearKm: 0 },
});
