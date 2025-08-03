export const prerender = false;

import { getAnilistData } from "./anilist";
import { getOsuData } from "./osu";
import { getSimklData } from "./simkl";
import { getSteamData } from "./steam";
import { getWakatimeData } from "./wakatime";

// Create a timeout wrapper for API calls
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs));

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    console.warn("API call failed or timed out:", error);
    return fallback;
  }
}

export async function getAllStats() {
  // Run all API calls in parallel with 5-second timeout
  const [osuData, wakatimeData, anilistData, steamData, simklData] = await Promise.all([
    withTimeout(getOsuData(), 5000, { playTime: 0 }),
    withTimeout(getWakatimeData(), 5000, { programmingHours: 0 }),
    withTimeout(getAnilistData(), 5000, { animeDaysWatched: 0 }),
    withTimeout(getSteamData(), 5000, { gamingHours: 0 }),
    withTimeout(getSimklData(), 5000, {
      movies: { hoursWatched: 0, completedCount: 0 },
      shows: { hoursWatched: 0, completedCount: 0 },
    }),
  ]);

  const finalData = {
    osu: osuData,
    wakatime: wakatimeData,
    anilist: anilistData,
    steam: steamData,
    simkl: simklData,
  };

  return finalData;
}

export async function GET() {
  const allStats = await getAllStats();

  return new Response(JSON.stringify(allStats), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    },
  });
}
