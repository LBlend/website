import { STEAM_API_KEY, STEAM_URL, STEAM_USER_ID } from "astro:env/server";
import { defineSource, fetchJson, HOUR } from "./source";

interface SteamPayload {
  // `games` is missing when the profile's game details are private
  response: { games?: { appid: number; playtime_forever: number }[] };
}

export default defineSource({
  name: "steam",
  intervalMs: HOUR,
  isConfigured: () => Boolean(STEAM_API_KEY && STEAM_USER_ID),
  fetch: (signal) =>
    fetchJson<SteamPayload>(
      `${STEAM_URL}IPlayerService/GetOwnedGames/v0001/?` +
        new URLSearchParams({
          key: STEAM_API_KEY ?? "",
          steamid: STEAM_USER_ID ?? "",
          include_played_free_games: "1",
          format: "json",
        }),
      {},
      signal,
    ),
  derive: (payload) => {
    if (!payload.response) throw new Error("Unexpected Steam response");
    const minutes = (payload.response.games ?? []).reduce((acc, game) => acc + (game.playtime_forever ?? 0), 0);
    return { gamingHours: minutes / 60 };
  },
  fallback: { gamingHours: 0 },
});
