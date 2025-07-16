export const prerender = false;

import cache from "@api/_cache";

interface SimklData {
  movies: {
    hoursWatched: number;
    completedCount: number;
  };
  shows: {
    hoursWatched: number;
    completedCount: number;
  };
}

export async function getSimklData(): Promise<SimklData> {
  const cacheKey = "simklData";
  const cached = cache.get<SimklData>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${import.meta.env.SIMKL_URL}users/${import.meta.env.SIMKL_USER_ID}/stats`, {
    method: "GET",
    cache: "force-cache",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return {
      movies: { hoursWatched: 0, completedCount: 0 },
      shows: { hoursWatched: 0, completedCount: 0 },
    };
  }

  const data = await res.json();
  const result = {
    movies: { hoursWatched: data.movies.total_mins / 60, completedCount: data.movies.completed.count },
    shows: { hoursWatched: data.tv.total_mins / 60, completedCount: data.tv.completed.count },
  };
  cache.set(cacheKey, result, 12 * 60 * 60 * 1000); // 12 hours
  return result;
}

export async function GET() {
  const simklData = await getSimklData();

  return new Response(JSON.stringify(simklData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
