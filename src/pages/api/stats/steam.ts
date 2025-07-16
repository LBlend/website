export const prerender = false;

import cache from "@api/_cache";

interface SteamData {
  gamingHours: number; // in hours
}

export async function getSteamData(): Promise<SteamData> {
  const cacheKey = "steamData";
  const cached = cache.get<SteamData>(cacheKey);
  if (cached) return cached;

  const queryParams = new URLSearchParams({
    key: import.meta.env.STEAM_API_KEY || "",
    steamid: import.meta.env.STEAM_USER_ID || "",
    include_played_free_games: "1",
    format: "json",
  });
  const res = await fetch(`${import.meta.env.STEAM_URL}IPlayerService/GetOwnedGames/v0001/?` + queryParams, {
    method: "GET",
    cache: "force-cache",
  });

  if (!res.ok) {
    return { gamingHours: 0 };
  }

  const data = await res.json();
  const totalGamingHours = data.response.games.reduce((acc: number, game: { playtime_forever: number }) => {
    if (game.playtime_forever) {
      return acc + game.playtime_forever;
    }
    return acc;
  }, 0);

  const result = { gamingHours: totalGamingHours / 60 };
  cache.set(cacheKey, result, 12 * 60 * 60 * 1000); // 12 hours
  return result;
}

export async function GET() {
  const steamData = await getSteamData();

  return new Response(JSON.stringify(steamData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
