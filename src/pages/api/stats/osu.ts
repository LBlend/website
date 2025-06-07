export const prerender = false;

interface OsuData {
  playTime: number; // in hours
}

let osuToken: string | null = null;

async function getOsuToken(): Promise<string | null> {
  const res = await fetch(`${import.meta.env.OSU_URL}oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: import.meta.env.OSU_CLIENT_ID || "",
      client_secret: import.meta.env.OSU_CLIENT_SECRET || "",
      grant_type: "client_credentials",
      scope: "public",
    }),
  });

  if (!res.ok) {
    console.error("Failed to fetch osu! token", res.status, res.statusText);
    return null;
  }

  const data = await res.json();
  return data.access_token;
}

export async function getOsuData(): Promise<OsuData> {
  if (!osuToken) {
    osuToken = await getOsuToken();
  }

  const res = await fetch(`${import.meta.env.OSU_URL}api/v2/users/${import.meta.env.OSU_USER_ID}/osu?key=id`, {
    method: "GET",
    cache: "force-cache",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${osuToken}`,
    },
  });

  if (!res.ok) {
    return { playTime: 0 };
  }

  const data = await res.json();
  return { playTime: data.statistics.play_time / 3600 };
}

export async function GET() {
  const osuData = await getOsuData();

  return new Response(JSON.stringify(osuData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
