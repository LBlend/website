export const prerender = false;

import { DAWARICH_API_KEY, DAWARICH_URL } from "astro:env/server";
import cache from "@api/_cache";

interface DawarichData {
  distanceThisYearKm: number;
}

interface DawarichStatsResponse {
  yearlyStats: { year: number; totalDistanceKm: number }[];
}

export async function getDawarichData(): Promise<DawarichData> {
  const cacheKey = "dawarichData";
  const cached = cache.get<DawarichData>(cacheKey);
  if (cached) return cached;
  if (!DAWARICH_API_KEY) {
    return { distanceThisYearKm: 0 };
  }

  const queryParams = new URLSearchParams({ api_key: DAWARICH_API_KEY });
  const res = await fetch(`${DAWARICH_URL}api/v1/stats?` + queryParams, {
    method: "GET",
  });

  if (!res.ok) {
    return { distanceThisYearKm: 0 };
  }

  const data: DawarichStatsResponse = await res.json();
  const currentYear = Number(new Date().toLocaleString("en", { timeZone: "Europe/Oslo", year: "numeric" }));
  const thisYear = data.yearlyStats?.find((stats) => stats.year === currentYear);

  const result = { distanceThisYearKm: thisYear?.totalDistanceKm ?? 0 };
  cache.set(cacheKey, result, 12 * 60 * 60 * 1000); // 12 hours
  return result;
}

export async function GET() {
  const dawarichData = await getDawarichData();

  return new Response(JSON.stringify(dawarichData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
