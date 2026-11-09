export const prerender = false;

import { WAKATIME_API_KEY, WAKATIME_URL, WAKATIME_USERNAME } from "astro:env/server";
import cache from "@api/_cache";

interface WakatimeData {
  programmingHours: number; // in hours
}

export async function getWakatimeData(): Promise<WakatimeData> {
  const cacheKey = "wakatimeData";
  const cached = cache.get<WakatimeData>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${WAKATIME_URL}users/@${WAKATIME_USERNAME}/all_time_since_today`, {
    method: "GET",
    cache: "force-cache",
    headers: {
      Authorization: `Basic  ${btoa(WAKATIME_API_KEY ?? "")}`,
    },
  });

  if (!res.ok) {
    return { programmingHours: 0 };
  }

  const data = await res.json();
  const result = { programmingHours: data.data.total_seconds / 3600 };
  cache.set(cacheKey, result, 12 * 60 * 60 * 1000); // 12 hours
  return result;
}

export async function GET() {
  const wakatimeData = await getWakatimeData();

  return new Response(JSON.stringify(wakatimeData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
