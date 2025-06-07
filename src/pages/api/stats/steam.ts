export const prerender = false;

interface SteamData {
  gamingHours: number; // in hours
}

export async function getSteamData(): Promise<SteamData> {
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

  return { gamingHours: totalGamingHours / 60 };
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
