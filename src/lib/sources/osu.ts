import { OSU_CLIENT_ID, OSU_CLIENT_SECRET, OSU_URL, OSU_USER_ID } from "astro:env/server";
import { defineSource, fetchJson, HOUR } from "./source";

interface OsuPayload {
  statistics: { play_time: number };
}

let token: { value: string; expiresAt: number } | null = null;

async function getToken(signal: AbortSignal): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;

  const data = await fetchJson<{ access_token: string; expires_in: number }>(
    `${OSU_URL}oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: OSU_CLIENT_ID ?? "",
        client_secret: OSU_CLIENT_SECRET ?? "",
        grant_type: "client_credentials",
        scope: "public",
      }),
    },
    signal,
  );
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 - 60_000 };
  return token.value;
}

export default defineSource({
  name: "osu",
  intervalMs: HOUR,
  isConfigured: () => Boolean(OSU_CLIENT_ID && OSU_CLIENT_SECRET && OSU_USER_ID),
  fetch: async (signal) =>
    fetchJson<OsuPayload>(
      `${OSU_URL}api/v2/users/${OSU_USER_ID}/osu?key=id`,
      { headers: { Accept: "application/json", Authorization: `Bearer ${await getToken(signal)}` } },
      signal,
    ),
  derive: (payload) => ({ playTime: payload.statistics.play_time / 3600 }),
  fallback: { playTime: 0 },
});
